import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'
import type { InferLimiters } from '@adonisjs/limiter/types'

const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),
  stores: {
    /**
     * Redis store: guarda los contadores de rate limiting
     * en Redis (rápido, y se limpia solo con TTL).
     */
    redis: stores.redis({
      connectionName: 'main',
    }),

    /**
     * Memory store: útil para tests, no persiste entre
     * reinicios del proceso.
     */
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
