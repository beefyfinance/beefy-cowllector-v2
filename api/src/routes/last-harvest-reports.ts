import { OpenAPIHono, z } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import type { Variables } from '../types';

// Define the schema for a single harvest report
const LastHarvestReportSchema = z
    .object({
        raw_report_id: z.number(),
        chain: z.string(),
        datetime: z.string(),
        run_ok: z.boolean(),
        vault_id: z.string(),
        eol: z.boolean(),
        strategy_address: z.string(),
        platform_id: z.string(),
        tvl_usd: z.number(),
        vault_is_clm_manager: z.boolean(),
        vault_is_clm_vault: z.boolean(),
        simulation_started: z.boolean(),
        simulation_ok: z.boolean(),
        simulation_ko_reason: z.string().nullable(),
        simulation_last_harvest: z.string().nullable(),
        simulation_hours_since_last_harvest: z.number().nullable(),
        simulation_is_last_harvest_recent: z.boolean().nullable(),
        simulation_is_calm_before_harvest: z.number().nullable(),
        simulation_paused: z.boolean().nullable(),
        simulation_block_number: z.number().nullable(),
        simulation_harvest_result_data: z.any().nullable(),
        simulation_gas_raw_gas_price: z.number().nullable(),
        simulation_gas_raw_gas_amount_estimation: z.number().nullable(),
        simulation_gas_estimated_call_rewards_wei: z.number().nullable(),
        simulation_gas_gas_price_multiplier: z.number().nullable(),
        simulation_gas_gas_price: z.number().nullable(),
        simulation_gas_transaction_cost_estimation_wei: z.number().nullable(),
        simulation_gas_estimated_gain_wei: z.number().nullable(),
        simulation_gas_would_be_profitable: z.boolean().nullable(),
        decision_started: z.boolean(),
        decision_ok: z.boolean(),
        decision_ko_reason: z.string().nullable(),
        decision_should_harvest: z.boolean().nullable(),
        decision_level: z.string().nullable(),
        decision_not_harvesting_reason: z.string().nullable(),
        decision_might_need_eol: z.boolean(),
        decision_harvest_return_data: z.string().nullable(),
        decision_harvest_return_data_decoded: z.string().nullable(),
        transaction_started: z.boolean(),
        transaction_ok: z.boolean(),
        transaction_ko_reason: z.string().nullable(),
        transaction_hash: z.string().nullable(),
        transaction_block_number: z.number().nullable(),
        transaction_gas_used: z.number().nullable(),
        transaction_effective_gas_price: z.number().nullable(),
        transaction_cost_wei: z.number().nullable(),
        transaction_balance_before_wei: z.number().nullable(),
        transaction_estimated_profit_wei: z.number().nullable(),
        summary_harvested: z.boolean().nullable(),
        summary_skipped: z.boolean().nullable(),
        summary_status: z.string().nullable(),
    })
    .openapi('LastHarvestReport');

// Response schema
const ResponseSchema = z
    .object({
        data: z.array(LastHarvestReportSchema),
    })
    .openapi('LastHarvestReportsResponse');

export const lastHarvestReportApi = new OpenAPIHono<{ Variables: Variables }>();

// Export types for use in the handler
export type LastHarvestReportResponse = z.infer<typeof ResponseSchema>;

// Route definition
const lastHarvestReportsRoute = createRoute({
    method: 'get',
    path: '/last-harvest-reports',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: ResponseSchema,
                },
            },
            description: 'List of last harvest reports for each vault',
        },
        500: {
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                    }),
                },
            },
            description: 'Server error',
        },
    },
});

lastHarvestReportApi.openapi(lastHarvestReportsRoute, async c => {
    const query = `
      SELECT 
        r.raw_report_id, r.chain, r.datetime, r.run_ok, r.vault_id,
        v.eol, bytea_to_hexstr(v.strategy_address) as strategy_address, v.platform_id, v.tvl_usd,
        r.vault_is_clm_manager, r.vault_is_clm_vault,
        r.simulation_started, r.simulation_ok, 'redacted' as simulation_ko_reason,
        r.simulation_last_harvest, r.simulation_hours_since_last_harvest,
        r.simulation_is_last_harvest_recent, r.simulation_is_calm_before_harvest, r.simulation_paused,
        r.simulation_block_number, r.simulation_harvest_result_data,
        r.simulation_gas_raw_gas_price, r.simulation_gas_raw_gas_amount_estimation,
        r.simulation_gas_estimated_call_rewards_wei, r.simulation_gas_gas_price_multiplier,
        r.simulation_gas_gas_price, r.simulation_gas_transaction_cost_estimation_wei,
        r.simulation_gas_estimated_gain_wei, r.simulation_gas_would_be_profitable,
        r.decision_started, r.decision_ok, 'redacted' as decision_ko_reason,
        r.decision_should_harvest, r.decision_level, r.decision_not_harvesting_reason,
        r.decision_might_need_eol, r.decision_harvest_return_data,
        r.decision_harvest_return_data_decoded,
        r.transaction_started, r.transaction_ok, 'redacted' as transaction_ko_reason,
        bytea_to_hexstr(r.transaction_hash) as transaction_hash, r.transaction_block_number, r.transaction_gas_used,
        r.transaction_effective_gas_price, r.transaction_cost_wei,
        r.transaction_balance_before_wei, r.transaction_estimated_profit_wei,
        r.summary_harvested, r.summary_skipped, r.summary_status
      FROM harvest_report_last_vault_details r
      LEFT JOIN vault v ON v.id = r.vault_id
      ORDER BY datetime DESC
    `;

    try {
        const result = await c.get('db').query(query);

        const response: LastHarvestReportResponse = {
            data: result.rows,
        };

        return c.json(response);
    } catch (error) {
        console.error('Database query failed:', error);
        return c.json({ error: 'Database query failed' }, 500);
    }
});

// Add new route definition for single vault lookup
const lastHarvestReportByVaultRoute = createRoute({
    method: 'get',
    path: '/last-harvest-reports/:vaultId',
    request: {
        params: z.object({
            vaultId: z.string().openapi({
                param: {
                    name: 'vaultId',
                    in: 'path',
                    description: 'The ID of the vault to fetch the last harvest report for',
                    required: true,
                },
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: LastHarvestReportSchema,
                },
            },
            description: 'Last harvest report for the specified vault',
        },
        404: {
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                    }),
                },
            },
            description: 'Vault not found',
        },
        500: {
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                    }),
                },
            },
            description: 'Server error',
        },
    },
});

// Add the new route handler
lastHarvestReportApi.openapi(lastHarvestReportByVaultRoute, async c => {
    const { vaultId } = c.req.param();

    const query = `
      SELECT 
        r.raw_report_id, r.chain, r.datetime, r.run_ok, r.vault_id,
        v.eol, bytea_to_hexstr(v.strategy_address) as strategy_address, v.platform_id, v.tvl_usd,
        r.vault_is_clm_manager, r.vault_is_clm_vault,
        r.simulation_started, r.simulation_ok, 'redacted' as simulation_ko_reason,
        r.simulation_last_harvest, r.simulation_hours_since_last_harvest,
        r.simulation_is_last_harvest_recent, r.simulation_is_calm_before_harvest, r.simulation_paused,
        r.simulation_block_number, r.simulation_harvest_result_data,
        r.simulation_gas_raw_gas_price, r.simulation_gas_raw_gas_amount_estimation,
        r.simulation_gas_estimated_call_rewards_wei, r.simulation_gas_gas_price_multiplier,
        r.simulation_gas_gas_price, r.simulation_gas_transaction_cost_estimation_wei,
        r.simulation_gas_estimated_gain_wei, r.simulation_gas_would_be_profitable,
        r.decision_started, r.decision_ok, 'redacted' as decision_ko_reason,
        r.decision_should_harvest, r.decision_level, r.decision_not_harvesting_reason,
        r.decision_might_need_eol, r.decision_harvest_return_data,
        r.decision_harvest_return_data_decoded,
        r.transaction_started, r.transaction_ok, 'redacted' as transaction_ko_reason,
        bytea_to_hexstr(r.transaction_hash) as transaction_hash, r.transaction_block_number, r.transaction_gas_used,
        r.transaction_effective_gas_price, r.transaction_cost_wei,
        r.transaction_balance_before_wei, r.transaction_estimated_profit_wei,
        r.summary_harvested, r.summary_skipped, r.summary_status
      FROM harvest_report_last_vault_details r
      LEFT JOIN vault v ON v.id = r.vault_id
      WHERE r.vault_id = $1
    `;

    try {
        const result = await c.get('db').query(query, [vaultId]);

        if (result.rows.length === 0) {
            return c.json({ error: 'Vault not found' }, 404);
        }

        return c.json(result.rows[0]);
    } catch (error) {
        console.error('Database query failed:', error);
        return c.json({ error: 'Database query failed' }, 500);
    }
});
