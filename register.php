<?php
session_start();
header('Content-Type: application/json');

// ✅ Allow only POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed.']);
    exit;
}

// ✅ Get and sanitize POST data
$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';
$role = $_POST['role'] ?? 'viewer'; // Default role

// ✅ Input validation
if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Username and password are required.']);
    exit;
}

if (!in_array($role, ['admin', 'operator', 'viewer'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid role provided.']);
    exit;
}

try {
    // ✅ Connect to database
    require_once __DIR__ . '/../db.php'; // $pdo should be created in this file

    // ✅ Check if username already exists
    $checkStmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $checkStmt->execute([$username]);
    if ($checkStmt->fetch()) {
        http_response_code(409); // Conflict
        echo json_encode(['success' => false, 'message' => 'Username already exists.']);
        exit;
    }

    // ✅ Hash the password
    $password_hash = password_hash($password, PASSWORD_DEFAULT);

    // ✅ Insert new user
    $stmt = $pdo->prepare("INSERT INTO users (username, role, password_hash) VALUES (?, ?, ?)");
    $stmt->execute([$username, $role, $password_hash]);

    echo json_encode(['success' => true, 'message' => 'User registered successfully.']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'A server error occurred.',
        'error' => $e->getMessage()
    ]);
}
