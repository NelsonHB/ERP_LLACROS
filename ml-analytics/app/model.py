from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

LAGS = (1, 7, 14, 28)
MIN_HISTORY_DAYS = 75
MIN_TRAIN_ROWS = 30
HOLDOUT_DAYS = 14

FEATURE_NAMES = [
    "day_index",
    "day_of_week",
    "day_of_month",
    "month",
    "day_of_year",
    "is_weekend",
    "lag_1",
    "lag_7",
    "lag_14",
    "lag_28",
    "rolling_mean_7",
    "rolling_mean_14",
    "rolling_mean_28",
]


def _prepare_history(records: list[dict[str, Any]]) -> tuple[pd.DataFrame, int, int]:
    if not records:
        raise ValueError("El historial no contiene ventas.")

    frame = pd.DataFrame(records)
    required = {"date", "revenue", "sales_count"}
    if not required.issubset(frame.columns):
        raise ValueError("El historial debe incluir date, revenue y sales_count.")

    frame["date"] = pd.to_datetime(frame["date"], errors="coerce").dt.normalize()
    frame = frame.dropna(subset=["date"])
    if frame.empty:
        raise ValueError("No se encontraron fechas válidas en el historial.")

    for column in ("revenue", "sales_count", "simulated_count", "real_count"):
        if column not in frame.columns:
            frame[column] = 0
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0).clip(lower=0)

    grouped = frame.groupby("date", as_index=True).agg(
        revenue=("revenue", "sum"),
        sales_count=("sales_count", "sum"),
        simulated_count=("simulated_count", "sum"),
        real_count=("real_count", "sum"),
    )

    # Completa días sin ventas con cero para conservar la secuencia diaria.
    calendar = pd.date_range(grouped.index.min(), grouped.index.max(), freq="D")
    daily = grouped.reindex(calendar, fill_value=0).astype(float)
    daily.index.name = "date"

    # Limita el entrenamiento a los dos años más recientes.
    if len(daily) > 730:
        daily = daily.iloc[-730:].copy()

    simulated_total = int(frame["simulated_count"].sum())
    real_total = int(frame["real_count"].sum())

    return daily, simulated_total, real_total


def _features(past: list[float], target_date: pd.Timestamp, day_index: int) -> list[float]:
    if len(past) < 28:
        raise ValueError("Se necesitan al menos 28 días previos para calcular los rezagos.")

    return [
        float(day_index),
        float(target_date.weekday()),
        float(target_date.day),
        float(target_date.month),
        float(target_date.dayofyear),
        float(int(target_date.weekday() >= 5)),
        float(past[-1]),
        float(past[-7]),
        float(past[-14]),
        float(past[-28]),
        float(np.mean(past[-7:])),
        float(np.mean(past[-14:])),
        float(np.mean(past[-28:])),
    ]


def _training_matrix(values: list[float], dates: pd.DatetimeIndex, end_index: int) -> tuple[np.ndarray, np.ndarray]:
    features: list[list[float]] = []
    targets: list[float] = []

    for index in range(28, end_index):
        features.append(_features(values[:index], dates[index], index))
        targets.append(float(values[index]))

    return np.asarray(features, dtype=float), np.asarray(targets, dtype=float)


def _new_model() -> RandomForestRegressor:
    # Hiperparámetros contenidos para reducir sobreajuste con históricos pequeños.
    return RandomForestRegressor(
        n_estimators=250,
        max_depth=6,
        min_samples_leaf=2,
        max_features=1.0,
        random_state=42,
        n_jobs=-1,
    )


def _recursive_predict(
    model: RandomForestRegressor,
    starting_values: list[float],
    future_dates: pd.DatetimeIndex,
    start_index: int,
) -> list[float]:
    history = list(starting_values)
    predictions: list[float] = []

    for offset, target_date in enumerate(future_dates):
        index = start_index + offset
        row = _features(history, target_date, index)
        prediction = float(model.predict(np.asarray([row], dtype=float))[0])
        prediction = max(0.0, prediction)
        predictions.append(prediction)
        history.append(prediction)

    return predictions


def _evaluate(values: list[float], dates: pd.DatetimeIndex) -> dict[str, Any]:
    n_days = len(values)
    holdout = min(HOLDOUT_DAYS, max(7, int(round(n_days * 0.18))))
    split = n_days - holdout

    X_train, y_train = _training_matrix(values, dates, split)
    if len(X_train) < MIN_TRAIN_ROWS:
        return {
            "status": "insufficient_history",
            "message": "No hay suficientes observaciones para evaluar el modelo con separación temporal.",
            "holdout_days": holdout,
            "training_samples": int(len(X_train)),
            "mae_daily_revenue": None,
            "wape_pct": None,
        }

    revenue_model = _new_model()
    revenue_model.fit(X_train, y_train)

    validation_dates = dates[split:]
    predictions = _recursive_predict(
        revenue_model,
        values[:split],
        validation_dates,
        split,
    )

    actual = np.asarray(values[split:], dtype=float)
    predicted = np.asarray(predictions, dtype=float)
    mae = float(mean_absolute_error(actual, predicted))
    denominator = float(np.sum(np.abs(actual)))
    wape = (float(np.sum(np.abs(actual - predicted))) / denominator * 100.0) if denominator > 0 else None

    return {
        "status": "evaluated",
        "message": "Evaluación cronológica: se entrenó con fechas anteriores y se evaluaron los últimos días disponibles.",
        "holdout_days": int(holdout),
        "training_samples": int(len(X_train)),
        "mae_daily_revenue": round(mae, 2),
        "wape_pct": round(wape, 2) if wape is not None else None,
    }


def forecast_sales(records: list[dict[str, Any]], horizon_months: int = 3) -> dict[str, Any]:
    if horizon_months not in (1, 2, 3):
        raise ValueError("El horizonte permitido es de 1, 2 o 3 meses.")

    daily, simulated_total, real_total = _prepare_history(records)
    n_days = len(daily)
    dates = pd.DatetimeIndex(daily.index)
    revenue_values = daily["revenue"].astype(float).tolist()
    count_values = daily["sales_count"].astype(float).tolist()

    source = "REAL"
    if simulated_total > 0 and real_total == 0:
        source = "DEMO"
    elif simulated_total > 0 and real_total > 0:
        source = "MIXED"
    elif real_total == 0 and simulated_total == 0:
        source = "UNKNOWN"

    monthly_history_frame = daily.copy()
    monthly_history_frame["month"] = monthly_history_frame.index.to_period("M").astype(str)
    historical_months = (
        monthly_history_frame.groupby("month")
        .agg(revenue=("revenue", "sum"), sales_count=("sales_count", "sum"))
        .reset_index()
        .tail(6)
    )
    history_monthly = [
        {
            "month": str(row["month"]),
            "revenue": round(float(row["revenue"]), 2),
            "sales_count": int(round(float(row["sales_count"]))),
        }
        for _, row in historical_months.iterrows()
    ]

    if n_days < MIN_HISTORY_DAYS:
        return {
            "status": "insufficient_history",
            "model": "RandomForestRegressor (scikit-learn)",
            "data_source": source,
            "message": f"Se requieren al menos {MIN_HISTORY_DAYS} días calendario; actualmente hay {n_days}.",
            "history_days": n_days,
            "simulated_sales": simulated_total,
            "real_sales": real_total,
            "history_monthly": history_monthly,
            "forecast_monthly": [],
            "evaluation": None,
            "feature_importance": [],
            "last_observed_date": dates[-1].date().isoformat(),
        }

    evaluation = _evaluate(revenue_values, dates)
    X_all, y_revenue = _training_matrix(revenue_values, dates, n_days)
    X_count, y_count = _training_matrix(count_values, dates, n_days)

    if len(X_all) < MIN_TRAIN_ROWS or len(X_count) < MIN_TRAIN_ROWS:
        return {
            "status": "insufficient_history",
            "model": "RandomForestRegressor (scikit-learn)",
            "data_source": source,
            "message": "El historial no produce suficientes filas de entrenamiento después de calcular los rezagos.",
            "history_days": n_days,
            "simulated_sales": simulated_total,
            "real_sales": real_total,
            "history_monthly": history_monthly,
            "forecast_monthly": [],
            "evaluation": evaluation,
            "feature_importance": [],
            "last_observed_date": dates[-1].date().isoformat(),
        }

    revenue_model = _new_model()
    revenue_model.fit(X_all, y_revenue)

    count_model = _new_model()
    count_model.fit(X_count, y_count)

    last_date = dates[-1]
    forecast_end = last_date + pd.DateOffset(months=horizon_months)
    future_dates = pd.date_range(
        start=last_date + pd.Timedelta(days=1),
        end=forecast_end,
        freq="D",
    )

    revenue_predictions = _recursive_predict(
        revenue_model,
        revenue_values,
        future_dates,
        n_days,
    )
    count_predictions_raw = _recursive_predict(
        count_model,
        count_values,
        future_dates,
        n_days,
    )
    count_predictions = [max(0, int(round(value))) for value in count_predictions_raw]

    forecast_daily = pd.DataFrame(
        {
            "revenue": revenue_predictions,
            "sales_count": count_predictions,
        },
        index=future_dates,
    )
    forecast_daily["month"] = forecast_daily.index.to_period("M").astype(str)
    monthly_forecast_frame = (
        forecast_daily.groupby("month")
        .agg(revenue=("revenue", "sum"), sales_count=("sales_count", "sum"))
        .reset_index()
    )

    forecast_monthly = []
    for _, row in monthly_forecast_frame.iterrows():
        revenue = max(0.0, float(row["revenue"]))
        sales_count = max(0, int(row["sales_count"]))
        forecast_monthly.append(
            {
                "month": str(row["month"]),
                "revenue": round(revenue, 2),
                "sales_count": sales_count,
                "average_ticket": round(revenue / sales_count, 2) if sales_count else 0.0,
            }
        )

    top_features = sorted(
        zip(FEATURE_NAMES, revenue_model.feature_importances_.tolist()),
        key=lambda item: item[1],
        reverse=True,
    )[:6]

    note = "Pronóstico calculado con el histórico disponible. Es una estimación, no una garantía."
    if source == "DEMO":
        note = "DEMOSTRACIÓN: el histórico utilizado contiene ventas SIM-. Sustituye estos registros por ventas reales antes de usar el pronóstico para decisiones comerciales."
    elif source == "MIXED":
        note = "El histórico mezcla ventas reales y registros SIM-. Separa o elimina los datos de prueba antes de usar el pronóstico para decisiones comerciales."

    return {
        "status": "ok",
        "model": "RandomForestRegressor (scikit-learn)",
        "task": "Regresión supervisada con características temporales y rezagos diarios.",
        "data_source": source,
        "message": note,
        "history_days": n_days,
        "training_samples": int(len(X_all)),
        "simulated_sales": simulated_total,
        "real_sales": real_total,
        "last_observed_date": last_date.date().isoformat(),
        "horizon_months": horizon_months,
        "history_monthly": history_monthly,
        "forecast_monthly": forecast_monthly,
        "forecast_total_revenue": round(sum(item["revenue"] for item in forecast_monthly), 2),
        "forecast_total_sales": sum(item["sales_count"] for item in forecast_monthly),
        "evaluation": evaluation,
        "feature_importance": [
            {"feature": name, "importance": round(float(value), 4)}
            for name, value in top_features
        ],
    }
