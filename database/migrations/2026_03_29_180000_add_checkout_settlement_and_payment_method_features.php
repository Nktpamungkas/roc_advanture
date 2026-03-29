<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_method_configs', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('type');
            $table->string('code')->unique();
            $table->string('bank_name')->nullable();
            $table->string('account_number')->nullable();
            $table->string('account_name')->nullable();
            $table->string('qr_image_path')->nullable();
            $table->text('instructions')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('rentals', function (Blueprint $table): void {
            $table->foreignId('payment_method_config_id')
                ->nullable()
                ->after('season_rule_id')
                ->constrained('payment_method_configs')
                ->nullOnDelete();
            $table->text('dp_override_reason')->nullable()->after('dp_amount');
            $table->unsignedInteger('final_total_days')->nullable()->after('total_days');
            $table->decimal('final_subtotal', 12, 2)->nullable()->after('subtotal');
            $table->string('settlement_basis')->nullable()->after('payment_status');
            $table->string('payment_method_name_snapshot')->nullable()->after('payment_method_config_id');
            $table->string('payment_method_type_snapshot')->nullable()->after('payment_method_name_snapshot');
            $table->string('payment_qr_image_path_snapshot')->nullable()->after('payment_method_type_snapshot');
            $table->string('payment_transfer_bank_snapshot')->nullable()->after('payment_qr_image_path_snapshot');
            $table->string('payment_transfer_account_number_snapshot')->nullable()->after('payment_transfer_bank_snapshot');
            $table->string('payment_transfer_account_name_snapshot')->nullable()->after('payment_transfer_account_number_snapshot');
            $table->text('payment_instruction_snapshot')->nullable()->after('payment_transfer_account_name_snapshot');
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->foreignId('payment_method_config_id')
                ->nullable()
                ->after('received_by')
                ->constrained('payment_method_configs')
                ->nullOnDelete();
            $table->string('method_label_snapshot')->nullable()->after('method');
            $table->string('method_type_snapshot')->nullable()->after('method_label_snapshot');
            $table->text('instructions_snapshot')->nullable()->after('method_type_snapshot');
        });

        Schema::table('returns', function (Blueprint $table): void {
            $table->string('charge_basis')->nullable()->after('returned_at');
            $table->unsignedInteger('final_total_days')->nullable()->after('charge_basis');
            $table->decimal('final_subtotal', 12, 2)->nullable()->after('final_total_days');
            $table->decimal('settlement_amount', 12, 2)->default(0)->after('final_subtotal');
        });
    }

    public function down(): void
    {
        Schema::table('returns', function (Blueprint $table): void {
            $table->dropColumn([
                'charge_basis',
                'final_total_days',
                'final_subtotal',
                'settlement_amount',
            ]);
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('payment_method_config_id');
            $table->dropColumn([
                'method_label_snapshot',
                'method_type_snapshot',
                'instructions_snapshot',
            ]);
        });

        Schema::table('rentals', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('payment_method_config_id');
            $table->dropColumn([
                'dp_override_reason',
                'final_total_days',
                'final_subtotal',
                'settlement_basis',
                'payment_method_name_snapshot',
                'payment_method_type_snapshot',
                'payment_qr_image_path_snapshot',
                'payment_transfer_bank_snapshot',
                'payment_transfer_account_number_snapshot',
                'payment_transfer_account_name_snapshot',
                'payment_instruction_snapshot',
            ]);
        });

        Schema::dropIfExists('payment_method_configs');
    }
};
