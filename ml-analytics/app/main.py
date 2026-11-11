from datetime import date
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .model import forecast_sales

app = FastAPI(
    title="EZCUDO360 Sales ML",
    description="Pronóstico demostrativo de ingresos y cantidad de ventas con Random Forest.",
    version="1.0.0",
)


class DailyRecord(BaseModel):
    date: date
    revenue: float = Field(ge=0)
    sales_count: int = Field(ge=0)
    simulated_count: int = Field(default=0, ge=0)
    real_count: int = Field(default=0, ge=0)


class ForecastRequest(BaseModel):
    history: List[DailyRecord] = Field(min_length=1)
    horizon_months: int = Field(default=3, ge=1, le=3)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ezcudo360-sales-ml"}


@app.post("/forecast")
def forecast(request: ForecastRequest):
    try:
        payload = [row.model_dump() for row in request.history]
        return forecast_sales(payload, request.horizon_months)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - respuesta controlada del microservicio
        # El detalle técnico queda en los logs de Docker, no se expone al ERP.
        print(f"[sales-ml] Error de pronóstico: {exc}", flush=True)
        raise HTTPException(
            status_code=500,
            detail="No se pudo entrenar o generar el pronóstico.",
        ) from exc
