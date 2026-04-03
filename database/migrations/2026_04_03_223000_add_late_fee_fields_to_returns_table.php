<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('returns', function (Blueprint $table): void {
            $table->unsignedInteger('late_fee_days')->default(0)->after('final_total_days');
            $table->decimal('late_fee_rate_per_day', 12, 2)->default(0)->after('late_fee_days');
            $table->decimal('late_fee_default_amount', 12, 2)->default(0)->after('late_fee_rate_per_day');
            $table->decimal('late_fee_amount', 12, 2)->default(0)->after('late_fee_default_amount');
            $table->text('late_fee_override_reason')->nullable()->after('late_fee_amount');
        });
    }

    public function down(): void
    {
        Schema::table('returns', function (Blueprint $table): void {
            $table->dropColumn([
                'late_fee_days',
                'late_fee_rate_per_day',
                'late_fee_default_amount',
                'late_fee_amount',
                'late_fee_override_reason',
            ]);
        });
    }
};
