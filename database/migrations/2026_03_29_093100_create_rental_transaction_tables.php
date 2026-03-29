<?php

use App\Support\Rental\CompensationTypes;
use App\Support\Rental\RentalPaymentStatuses;
use App\Support\Rental\RentalStatuses;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rentals', function (Blueprint $table): void {
            $table->id();
            $table->string('rental_no')->unique();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('season_rule_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('due_at');
            $table->unsignedInteger('total_days');
            $table->boolean('dp_required')->default(false);
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('dp_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('remaining_amount', 12, 2)->default(0);
            $table->string('payment_status')->default(RentalPaymentStatuses::UNPAID);
            $table->string('rental_status')->default(RentalStatuses::BOOKED);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('rental_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rental_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_unit_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('product_name_snapshot');
            $table->decimal('daily_rate_snapshot', 12, 2);
            $table->unsignedInteger('days');
            $table->decimal('line_total', 12, 2);
            $table->string('status_at_checkout');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rental_id')->constrained()->cascadeOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('payment_kind');
            $table->decimal('amount', 12, 2);
            $table->dateTime('paid_at');
            $table->string('method')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('returns', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rental_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('returned_at');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('return_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('return_id')->constrained('returns')->cascadeOnDelete();
            $table->foreignId('rental_item_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('replacement_unit_id')->nullable()->constrained('inventory_units')->nullOnDelete();
            $table->string('return_condition');
            $table->string('next_unit_status')->nullable();
            $table->string('compensation_type')->default(CompensationTypes::NONE);
            $table->decimal('compensation_amount', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('wa_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rental_id')->nullable()->constrained()->nullOnDelete();
            $table->string('phone');
            $table->string('message_type');
            $table->dateTime('scheduled_at');
            $table->dateTime('sent_at')->nullable();
            $table->string('status')->default('pending');
            $table->string('provider_message_id')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_logs');
        Schema::dropIfExists('return_items');
        Schema::dropIfExists('returns');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('rental_items');
        Schema::dropIfExists('rentals');
    }
};
