<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TransactionalDataPurgeService
{
    /**
     * @return array<int, string>
     */
    public function masterTables(): array
    {
        $permissionTables = array_values(array_filter([
            config('permission.table_names.roles'),
            config('permission.table_names.permissions'),
            config('permission.table_names.model_has_permissions'),
            config('permission.table_names.model_has_roles'),
            config('permission.table_names.role_has_permissions'),
        ]));

        return array_values(array_unique(array_merge([
            'users',
            'products',
            'inventory_units',
            'customers',
            'season_rules',
            'payment_method_configs',
            'app_settings',
            'sale_products',
        ], $permissionTables)));
    }

    /**
     * @return array<int, string>
     */
    public function transactionalTables(): array
    {
        return [
            'combined_orders',
            'manual_incomes',
            'midtrans_webhook_logs',
            'payments',
            'rental_extensions',
            'rental_items',
            'rentals',
            'return_items',
            'returns',
            'sale_items',
            'sales',
            'stock_movements',
            'stock_opname_rental_items',
            'stock_opname_sale_items',
            'stock_opname_sessions',
            'stock_receipt_items',
            'stock_receipts',
            'wa_logs',
            'failed_jobs',
            'job_batches',
            'jobs',
            'sessions',
            'cache_locks',
            'cache',
            'password_reset_tokens',
        ];
    }

    /**
     * @return array{master_tables: array<int, string>, transactional_tables: array<int, string>, table_counts: array<string, int>}
     */
    public function preview(): array
    {
        $transactionalTables = $this->existingTables($this->transactionalTables());
        $tableCounts = [];

        foreach ($transactionalTables as $table) {
            $tableCounts[$table] = DB::table($table)->count();
        }

        return [
            'master_tables' => $this->existingTables($this->masterTables()),
            'transactional_tables' => $transactionalTables,
            'table_counts' => $tableCounts,
        ];
    }

    /**
     * @return array{deleted_tables: array<int, string>, deleted_rows: array<string, int>, deleted_total: int}
     */
    public function purge(): array
    {
        $transactionalTables = $this->existingTables($this->transactionalTables());
        $deletedRows = [];
        $deletedTotal = 0;

        Schema::disableForeignKeyConstraints();

        try {
            foreach ($transactionalTables as $table) {
                $deletedRows[$table] = DB::table($table)->delete();
                $deletedTotal += $deletedRows[$table];
            }

            if (DB::connection()->getDriverName() === 'sqlite') {
                foreach ($transactionalTables as $table) {
                    DB::statement('DELETE FROM sqlite_sequence WHERE name = ?', [$table]);
                }
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        return [
            'deleted_tables' => $transactionalTables,
            'deleted_rows' => $deletedRows,
            'deleted_total' => $deletedTotal,
        ];
    }

    /**
     * @param  array<int, string>  $tables
     * @return array<int, string>
     */
    private function existingTables(array $tables): array
    {
        return array_values(array_filter($tables, static fn (string $table): bool => Schema::hasTable($table)));
    }
}
