<?php
session_start();
header('Content-Type: application/json');

// ✅ Check login
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401); // Unauthorized
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

try {
    // ✅ MySQL DB connection
    require_once __DIR__ . '/../db.php'; // Assumes MySQL PDO in db.php

    // ✅ Calculate stats
    $total_buildings = $pdo->query("SELECT COUNT(id) FROM buildings")->fetchColumn();
    $total_devices = $pdo->query("SELECT COUNT(id) FROM switches")->fetchColumn();
    $active_devices = $pdo->query("SELECT COUNT(id) FROM switches WHERE device_status = 1")->fetchColumn();
$inactive_devices = $pdo->query("SELECT COUNT(id) FROM switches WHERE device_status = 0")->fetchColumn();



    $stats = [
        'total_buildings' => (int)$total_buildings,
        'total_devices' => (int)$total_devices,
        'active_devices' => (int)$active_devices,
        'inactive_devices' => (int)$inactive_devices
    ];

    echo json_encode(['success' => true, 'data' => $stats]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
