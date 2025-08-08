<?php
// File: /api/get_logs.php

header('Content-Type: application/json');

try {
    // ✅ Connect to MySQL via db.php
    require_once __DIR__ . '/../db.php'; // should define $pdo (PDO connection)

    // ✅ Fetch the latest 20 log entries, including switch/device name
    $stmt = $pdo->query("
        SELECT 
            l.id, 
            l.change_type, 
            l.old_value, 
            l.new_value, 
            l.timestamp, 
            s.name AS device_name 
        FROM logs l
        LEFT JOIN switches s ON l.switch_id = s.id
        ORDER BY l.timestamp DESC 
        LIMIT 20
    ");

    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $logs]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
