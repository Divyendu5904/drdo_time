<?php
session_start();
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed.']);
    exit;
}

$name = $_POST['name'] ?? null;
$location = $_POST['location'] ?? '';

if (empty($name)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Building name is required.']);
    exit;
}

require_once __DIR__ . '/../db.php'; // connect to MySQL using db.php

try {
    $stmt = $pdo->prepare("INSERT INTO buildings (name, location) VALUES (?, ?)");
    $stmt->execute([$name, $location]);

    echo json_encode(['success' => true, 'message' => 'Building added successfully.']);

} catch (PDOException $e) {
    if ($e->getCode() == 23000) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'A building with this name already exists.']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
}
