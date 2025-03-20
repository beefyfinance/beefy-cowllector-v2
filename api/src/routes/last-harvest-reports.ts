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
        raw_report_id, chain, datetime, run_ok, vault_id,
        vault_is_clm_manager, vault_is_clm_vault,
        simulation_started, simulation_ok, 'redacted' as simulation_ko_reason,
        simulation_last_harvest, simulation_hours_since_last_harvest,
        simulation_is_last_harvest_recent, simulation_is_calm_before_harvest, simulation_paused,
        simulation_block_number, simulation_harvest_result_data,
        simulation_gas_raw_gas_price, simulation_gas_raw_gas_amount_estimation,
        simulation_gas_estimated_call_rewards_wei, simulation_gas_gas_price_multiplier,
        simulation_gas_gas_price, simulation_gas_transaction_cost_estimation_wei,
        simulation_gas_estimated_gain_wei, simulation_gas_would_be_profitable,
        decision_started, decision_ok, 'redacted' as decision_ko_reason,
        decision_should_harvest, decision_level, decision_not_harvesting_reason,
        decision_might_need_eol, decision_harvest_return_data,
        decision_harvest_return_data_decoded,
        transaction_started, transaction_ok, 'redacted' as transaction_ko_reason,
        bytea_to_hexstr(transaction_hash) as transaction_hash, transaction_block_number, transaction_gas_used,
        transaction_effective_gas_price, transaction_cost_wei,
        transaction_balance_before_wei, transaction_estimated_profit_wei,
        summary_harvested, summary_skipped, summary_status
      FROM harvest_report_last_vault_details
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
        raw_report_id, chain, datetime, run_ok, vault_id,
        vault_is_clm_manager, vault_is_clm_vault,
        simulation_started, simulation_ok, 'redacted' as simulation_ko_reason,
        simulation_last_harvest, simulation_hours_since_last_harvest,
        simulation_is_last_harvest_recent, simulation_is_calm_before_harvest, simulation_paused,
        simulation_block_number, simulation_harvest_result_data,
        simulation_gas_raw_gas_price, simulation_gas_raw_gas_amount_estimation,
        simulation_gas_estimated_call_rewards_wei, simulation_gas_gas_price_multiplier,
        simulation_gas_gas_price, simulation_gas_transaction_cost_estimation_wei,
        simulation_gas_estimated_gain_wei, simulation_gas_would_be_profitable,
        decision_started, decision_ok, 'redacted' as decision_ko_reason,
        decision_should_harvest, decision_level, decision_not_harvesting_reason,
        decision_might_need_eol, decision_harvest_return_data,
        decision_harvest_return_data_decoded,
        transaction_started, transaction_ok, 'redacted' as transaction_ko_reason,
        bytea_to_hexstr(transaction_hash) as transaction_hash, transaction_block_number, transaction_gas_used,
        transaction_effective_gas_price, transaction_cost_wei,
        transaction_balance_before_wei, transaction_estimated_profit_wei,
        summary_harvested, summary_skipped, summary_status
      FROM harvest_report_last_vault_details
      WHERE vault_id = $1
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
