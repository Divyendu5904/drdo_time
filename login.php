<?php
session_start();
header('Content-Type: application/json');

// ✅ Only allow POST method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed.']);
    exit;
}

// ✅ Get POST data
$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';

// ✅ Validate input
if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Username and password are required.']);
    exit;
}

try {
    // ✅ Connect to the database (SQLite or MySQL via db.php)
    require_once __DIR__ . '/../db.php'; // $pdo must be defined in db.php

    // ✅ Prepare statement to fetch user
    $stmt = $pdo->prepare("SELECT id, username, password_hash, role FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // ✅ Verify password
    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['loggedin'] = true;
        $_SESSION['id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];

        echo json_encode(['success' => true, 'message' => 'Login successful.']);
    } else {
        http_response_code(401); // Unauthorized
        echo json_encode(['success' => false, 'message' => 'Invalid username or password.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'A server error occurred.',
        'error' => $e->getMessage()
    ]);
}
