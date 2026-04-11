<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manual_incomes', function (Blueprint $table): void {
            $table->id();
            $table->string('income_no')->unique();
            $table->dateTime('recorded_at');
            $table->foreignId('recorded_by')->constrained('users');
            $table->string('category', 50);
            $table->string('title', 150);
            $table->decimal('amount', 14, 2);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manual_incomes');
    }
};
