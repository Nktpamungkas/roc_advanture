<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Services\MidtransWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class MidtransWebhookController extends Controller
{
    public function __construct(
        private readonly MidtransWebhookService $midtransWebhookService,
    ) {}

    public function store(Request $request): JsonResponse
    {
        try {
            $result = $this->midtransWebhookService->handle($request->all());
        } catch (RuntimeException|ValidationException $exception) {
            return response()->json([
                'received' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        if (! (bool) ($result['signature_valid'] ?? false)) {
            return response()->json([
                'received' => true,
                'processed' => false,
                'message' => $result['message'] ?? 'Invalid signature.',
            ]);
        }

        return response()->json([
            'received' => true,
            'processed' => (bool) ($result['processed'] ?? false),
            'message' => $result['message'] ?? 'Webhook processed.',
            'target_type' => $result['target_type'] ?? null,
            'target_key' => $result['target_key'] ?? null,
        ]);
    }
}
