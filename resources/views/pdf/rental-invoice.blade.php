<!DOCTYPE html>
<html lang="id">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Invoice Sewa {{ $rental->rental_no }}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            color: #171717;
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            line-height: 1.45;
        }
        .page { padding: 18px 22px 20px; }
        .topbar {
            margin: 0 -22px 18px;
            padding: 8px 22px;
            background: #111111;
            color: #ffffff;
            overflow: hidden;
        }
        .topbar-left {
            float: left;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.22em;
            text-transform: uppercase;
        }
        .topbar-right {
            float: right;
            background: #ffffff;
            color: #111111;
            padding: 2px 8px;
            font-size: 13px;
            font-weight: 700;
        }
        .clearfix::after {
            content: "";
            display: block;
            clear: both;
        }
        .header {
            padding-bottom: 14px;
            border-bottom: 1px solid #d4d4d4;
        }
        .brand {
            float: left;
            width: 59%;
        }
        .meta {
            float: right;
            width: 37%;
        }
        .logo {
            float: left;
            width: 52px;
            height: 52px;
            margin-right: 14px;
            border: 1px solid #d4d4d4;
            border-radius: 999px;
            overflow: hidden;
        }
        .logo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .brand-name {
            margin: 2px 0 4px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.32em;
            text-transform: uppercase;
            color: #525252;
        }
        .store-copy {
            margin: 0;
            color: #525252;
            font-size: 10px;
            line-height: 1.5;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
        }
        .meta-table td {
            padding: 1px 0;
            vertical-align: top;
        }
        .meta-label {
            width: 94px;
            color: #525252;
        }
        .section-grid {
            margin-top: 14px;
        }
        .section-box {
            width: 48.8%;
            min-height: 122px;
            border: 1px solid #d4d4d4;
            border-radius: 10px;
            padding: 12px 14px;
        }
        .section-box.left { float: left; }
        .section-box.right { float: right; }
        .section-title {
            margin: 0 0 10px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: #525252;
        }
        .detail-table {
            width: 100%;
            border-collapse: collapse;
        }
        .detail-table td {
            padding: 3px 0;
            vertical-align: top;
        }
        .detail-label {
            width: 92px;
            color: #525252;
        }
        .detail-label.wide { width: 98px; }
        .detail-split {
            width: 49%;
            float: left;
        }
        .detail-split.right { float: right; }
        .items-wrap {
            margin-top: 14px;
            border: 1px solid #d4d4d4;
            border-radius: 10px;
            overflow: hidden;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
        }
        .items-table thead th {
            background: #f5f5f5;
            padding: 10px 14px;
            text-align: left;
            font-weight: 600;
            color: #404040;
        }
        .items-table td {
            padding: 10px 14px;
            border-top: 1px solid #d4d4d4;
            vertical-align: top;
        }
        .items-table .number {
            text-align: right;
            white-space: nowrap;
        }
        .item-name {
            font-weight: 600;
            color: #171717;
        }
        .item-sub {
            margin-top: 3px;
            font-size: 10px;
            color: #6b7280;
        }
        .summary-area {
            margin-top: 12px;
            border-top: 1px solid #d4d4d4;
            padding-top: 12px;
        }
        .detail-area {
            float: left;
            width: 63%;
        }
        .amount-box {
            float: right;
            width: 31%;
            border: 1px solid #d4d4d4;
            border-radius: 10px;
            overflow: hidden;
        }
        .amount-head {
            padding: 10px 14px 8px;
            border-bottom: 1px solid #d4d4d4;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: #525252;
        }
        .amount-body {
            padding: 12px 14px 14px;
        }
        .amount-row {
            margin-bottom: 10px;
        }
        .amount-row .label {
            float: left;
            color: #404040;
        }
        .amount-row .value {
            float: right;
            font-weight: 500;
        }
        .amount-total {
            margin-top: 8px;
            padding-top: 10px;
            border-top: 1px solid #d4d4d4;
            font-size: 18px;
            font-weight: 700;
        }
        .amount-total .label { float: left; }
        .amount-total .value { float: right; }
        .info-box {
            margin-bottom: 10px;
            border: 1px solid #d4d4d4;
            border-radius: 8px;
            padding: 10px 12px;
        }
        .info-box:last-child { margin-bottom: 0; }
        .info-title {
            margin: 0 0 8px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #525252;
        }
        .payment-row {
            margin-bottom: 7px;
            padding-bottom: 7px;
            border-bottom: 1px solid #e5e5e5;
        }
        .payment-row:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: 0;
        }
        .payment-amount {
            font-weight: 600;
            color: #171717;
        }
        .payment-copy {
            font-size: 10px;
            color: #525252;
        }
        .qris-image {
            width: 118px;
            height: 118px;
            margin-top: 8px;
            border: 1px solid #d4d4d4;
            object-fit: contain;
        }
        .notes-list {
            margin: 0;
            padding-left: 16px;
        }
        .notes-list li {
            margin-bottom: 4px;
        }
        .footer {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid #d4d4d4;
            text-align: right;
            font-size: 9px;
            color: #737373;
        }
    </style>
</head>
<body>
@php
    $displayedSubtotal = $rental->final_subtotal ?? $rental->subtotal;
    $displayedDays = $rental->final_total_days ?? $rental->total_days;
    $paymentNotes = $rental->payments
        ->pluck('notes')
        ->filter(fn ($note) => filled(trim((string) $note)));
    $notesRows = collect([$rental->notes, $rental->dp_override_reason])
        ->merge($paymentNotes)
        ->filter(fn ($note) => filled(trim((string) $note)))
        ->values();
    $formatCurrency = fn ($value) => 'Rp'.number_format((float) ($value ?? 0), 0, ',', '.');
    $formatDate = fn ($value) => $value ? $value->timezone(config('app.timezone'))->format('d M Y') : '-';
    $formatTime = fn ($value) => $value ? $value->timezone(config('app.timezone'))->format('H:i') : '-';
@endphp

<div class="page">
    <div class="topbar clearfix">
        <div class="topbar-left">Invoice Sewa Roc Advanture</div>
        <div class="topbar-right">Invoice Sewa</div>
    </div>

    <div class="header clearfix">
        <div class="brand clearfix">
            @if ($logoDataUri)
                <div class="logo">
                    <img src="{{ $logoDataUri }}" alt="Roc Advanture">
                </div>
            @endif

            <div>
                <p class="brand-name">Roc Advanture</p>
                <p class="store-copy">Alamat: Jl. Raya Serang Km 16,8. Kp. Desa Talaga Rt 006/002, Cikupa, Tangerang, Kabupaten Tangerang, Banten 15710</p>
                <p class="store-copy">Telepon: 0887-1711-042</p>
            </div>
        </div>

        <div class="meta">
            <table class="meta-table">
                <tr>
                    <td class="meta-label">Invoice No.</td>
                    <td>{{ $rental->rental_no }}</td>
                </tr>
                <tr>
                    <td class="meta-label">Tanggal Terbit</td>
                    <td>{{ $formatDate($rental->starts_at) }}</td>
                </tr>
                <tr>
                    <td class="meta-label">Jatuh Tempo</td>
                    <td>{{ $formatDate($rental->due_at) }}</td>
                </tr>
                <tr>
                    <td class="meta-label">Admin</td>
                    <td>{{ $rental->creator?->name ?? '-' }}</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="section-grid clearfix">
        <div class="section-box left">
            <p class="section-title">Bill To</p>
            <table class="detail-table">
                @if (filled($rental->customer?->name))
                    <tr>
                        <td class="detail-label">Nama</td>
                        <td>{{ $rental->customer?->name }}</td>
                    </tr>
                @endif
                @if (filled($rental->customer?->phone_whatsapp))
                    <tr>
                        <td class="detail-label">No. Tlp</td>
                        <td>{{ $rental->customer?->phone_whatsapp }}</td>
                    </tr>
                @endif
                @if (filled($rental->customer?->address))
                    <tr>
                        <td class="detail-label">Alamat</td>
                        <td>{{ $rental->customer?->address }}</td>
                    </tr>
                @endif
            </table>
        </div>

        <div class="section-box right">
            <p class="section-title">Schedule</p>
            <div class="clearfix">
                <div class="detail-split">
                    <table class="detail-table">
                        <tr>
                            <td class="detail-label wide">Tanggal Sewa</td>
                            <td>{{ $formatDate($rental->starts_at) }}</td>
                        </tr>
                        <tr>
                            <td class="detail-label wide">Jam Sewa</td>
                            <td>{{ $formatTime($rental->starts_at) }}</td>
                        </tr>
                        <tr>
                            <td class="detail-label wide">Tanggal Kembali</td>
                            <td>{{ $formatDate($rental->due_at) }}</td>
                        </tr>
                    </table>
                </div>
                <div class="detail-split right">
                    <table class="detail-table">
                        <tr>
                            <td class="detail-label wide">Jam Kembali</td>
                            <td>{{ $formatTime($rental->due_at) }}</td>
                        </tr>
                        <tr>
                            <td class="detail-label wide">Durasi</td>
                            <td>{{ $displayedDays }} hari</td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <div class="items-wrap">
        <table class="items-table">
            <thead>
                <tr>
                    <th>Deskripsi</th>
                    <th>Nomor Unit</th>
                    <th>Durasi</th>
                    <th>Tarif</th>
                    <th class="number">Jumlah</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($rental->items as $item)
                    <tr>
                        <td>
                            <div class="item-name">{{ $item->product_name_snapshot }}</div>
                            <div class="item-sub">{{ \App\Support\Rental\InventoryUnitStatuses::label($item->status_at_checkout) }}</div>
                        </td>
                        <td>{{ $item->inventoryUnit?->unit_code ?? '-' }}</td>
                        <td>{{ $item->days }} hari</td>
                        <td>{{ $formatCurrency($item->daily_rate_snapshot) }}</td>
                        <td class="number">{{ $formatCurrency($item->line_total) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="summary-area clearfix">
        <div class="detail-area">
            @if ($rental->payments->isNotEmpty())
                <div class="info-box">
                    <p class="info-title">Riwayat Pembayaran</p>
                    @foreach ($rental->payments as $payment)
                        <div class="payment-row">
                            <div class="payment-amount">{{ $formatCurrency($payment->amount) }}</div>
                            <div class="payment-copy">
                                {{ $formatDate($payment->paid_at) }} {{ $formatTime($payment->paid_at) }} | {{ $payment->method_label_snapshot ?: \App\Support\Rental\PaymentMethods::label($payment->method) }} | {{ $payment->receiver?->name ?? '-' }}
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif

            @if (filled($rental->payment_method_name_snapshot))
                <div class="info-box">
                    <p class="info-title">Metode Pembayaran</p>
                    <div class="payment-amount">{{ $rental->payment_method_name_snapshot }}</div>

                    @if ($rental->payment_method_type_snapshot === 'transfer')
                        <div class="payment-copy">{{ $rental->payment_transfer_bank_snapshot }}</div>
                        <div class="payment-copy">{{ $rental->payment_transfer_account_number_snapshot }}</div>
                        <div class="payment-copy">{{ $rental->payment_transfer_account_name_snapshot }}</div>
                    @endif

                    @if ($rental->payment_method_type_snapshot === 'qris' && $paymentQrDataUri)
                        <img class="qris-image" src="{{ $paymentQrDataUri }}" alt="{{ $rental->payment_method_name_snapshot }}">
                    @endif

                    @if (filled($rental->payment_instruction_snapshot))
                        <div class="payment-copy" style="margin-top: 8px;">{{ $rental->payment_instruction_snapshot }}</div>
                    @endif
                </div>
            @endif

            @if ($notesRows->isNotEmpty())
                <div class="info-box">
                    <p class="info-title">Catatan</p>
                    <ul class="notes-list">
                        @foreach ($notesRows as $note)
                            <li>{{ $note }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif
        </div>

        <div class="amount-box">
            <div class="amount-head">Amount Due</div>
            <div class="amount-body">
                <div class="amount-row clearfix">
                    <div class="label">Total Sewa</div>
                    <div class="value">{{ $formatCurrency($displayedSubtotal) }}</div>
                </div>
                <div class="amount-row clearfix">
                    <div class="label">Dibayar</div>
                    <div class="value">{{ $formatCurrency($rental->paid_amount) }}</div>
                </div>
                <div class="amount-total clearfix">
                    <div class="label">Sisa</div>
                    <div class="value">{{ $formatCurrency($rental->remaining_amount) }}</div>
                </div>
            </div>
        </div>
    </div>

    <div class="footer">
        Dokumen invoice ini dibuat otomatis oleh sistem Roc Advanture.
    </div>
</div>
</body>
</html>
