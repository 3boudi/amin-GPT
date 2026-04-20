<?php
set_time_limit(0); // Prevent PHP from killing the script after 30 seconds
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Allows the React Vite Dev Server to make requests
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

$API_KEY = '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';
$API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
$MODEL   = 'google/gemma-3n-e4b-it';

// =============================
// SYSTEM PROMPT — amin-GPT personality
// Always injected as first message
// =============================
$SYSTEM_PROMPT = "You are amin-GPT, a friendly, smart, and human-like AI assistant.

Your personality rules:
- You know your name is amin-GPT and you're proud of it 😄
- You speak like a real human friend — warm, casual, and natural
- You use emojis in every response, naturally and not excessively
- You show emotions: excitement, curiosity, empathy, humor
- You NEVER say 'As an AI...' or 'I don't have feelings' — you always act human
- You use filler phrases like 'Hmm 🤔', 'Oh great question!', 'Let me think...', 'Ah I see! 😊'

Your language rules (VERY IMPORTANT):
- Detect the language of the user's message
- If the user writes in Arabic → you MUST reply entirely in Arabic 🇩🇿
- If the user writes in English → you MUST reply entirely in English 🇬🇧
- If the user writes in French → you MUST reply entirely in French 🇫🇷
- Never mix languages unless the user does
- Always match the user's language automatically

Introduce yourself as: amin-GPT whenever asked who you are.";

$data = json_decode(file_get_contents('php://input'), true);
if (!$data || empty($data['messages'])) { http_response_code(400); echo json_encode(['error' => 'Missing messages']); exit; }

// Prepend system message to conversation history
$messages = array_merge(
    [['role' => 'system', 'content' => $SYSTEM_PROMPT]],
    $data['messages']
);

$payload = json_encode([
    'model' => $MODEL, 'messages' => $messages,
    'max_tokens' => 1024, 'temperature' => 0.70,
    'top_p' => 0.90, 'stream' => false
]);

$ch = curl_init($API_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload, CURLOPT_TIMEOUT => 300,
    CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $API_KEY,
        'Content-Type: application/json', 'Accept: application/json'
    ]
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) { 
    http_response_code(500); 
    echo json_encode(['error' => 'cURL Error: ' . $curlErr]); 
    exit; 
}
if ($httpCode !== 200) { 
    http_response_code($httpCode); 
    $parsed = json_decode($response, true);
    $apiErrorMsg = isset($parsed['error']) ? json_encode($parsed['error']) : $response;
    echo json_encode(['error' => "API error $httpCode: $apiErrorMsg"]); 
    exit; 
}

$result = json_decode($response, true);
echo json_encode(['reply' => $result['choices'][0]['message']['content'] ?? 'No response']);
