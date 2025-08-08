<?php
header('Content-Type: application/json');

// ✅ Read and decode JSON input
$data = json_decode(file_get_contents("php://input"), true);

// ✅ Validate input
if (
    empty($data['username']) ||
    empty($data['password']) ||
    empty($data['role'])
) {
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit;
}

try {
    // ✅ Include MySQL DB connection
    require_once __DIR__ . '/../db.php'; // This file must set $pdo

    // ✅ Check for duplicate username
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
    $checkStmt->execute([$data['username']]);
    if ($checkStmt->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'message' => 'Username already exists.']);
        exit;
    }

    // ✅ Insert new user with hashed password
    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)");
    $stmt->execute([
        $data['username'],
        password_hash($data['password'], PASSWORD_DEFAULT),
        $data['role']
    ]);

    echo json_encode(['success' => true, 'message' => 'User added successfully.']);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
