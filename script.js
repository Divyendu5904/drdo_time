// File: script.js - Updated with Network Topology Integration

document.addEventListener('DOMContentLoaded', async () => {

    let currentUserRole = 'viewer'; // Default to least privileged role

    // --- First, check if the user is logged in and get their role ---
    try {
        const sessionResponse = await fetch('api/check_session.php');
        const sessionResult = await sessionResponse.json();

        if (!sessionResult.loggedin) {
            window.location.replace('login.html');
            return;
        }
        
        const username = sessionResult.username;
        currentUserRole = sessionResult.role;
        document.getElementById('username-display').textContent = `${username} (${currentUserRole})`;

    } catch (e) {
        window.location.replace('login.html');
        return;
    }

    // --- DOM Elements ---
    const addBuildingForm = document.getElementById('add-building-form');
    const addDeviceForm = document.getElementById('add-device-form');
    const devicesTableBody = document.getElementById('devices-table-body');
    const logsContainer = document.getElementById('logs-container');
    const errorSearchInput = document.getElementById('error-search-input');
    const errorGuidesContainer = document.getElementById('error-guides-container');
    const buildingSelectDropdown = document.getElementById('device-building');
    const logoutButton = document.getElementById('logout-button');
    const activeAlertsContainer = document.getElementById('active-alerts-container');
    const resolvedAlertsTbody = document.getElementById('resolved-alerts-tbody');
    
    // Admin Panel Elements
    const addUserForm = document.getElementById('add-user-form');
    const usersTableBody = document.getElementById('users-table-body');

    // Maintenance Elements
    const scheduleMaintenanceForm = document.getElementById('schedule-maintenance-form');
    const maintenanceDeviceDropdown = document.getElementById('maintenance-device');
    const maintenanceTableBody = document.getElementById('maintenance-table-body');

    // Guide Admin Elements
    const addGuideBtn = document.getElementById('add-guide-btn');
    const guideModal = document.getElementById('guide-modal');
    const guideForm = document.getElementById('guide-form');
    
    // Nav Elements
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');
    
    // Modal Elements
    const editDeviceModal = document.getElementById('edit-device-modal');
    const editDeviceForm = document.getElementById('edit-device-form');
    const historyChartModal = document.getElementById('history-chart-modal');
    const latencyChartCanvas = document.getElementById('latency-chart');

    // Dashboard Stat Elements
    const statTotalBuildings = document.getElementById('stat-total-buildings');
    const statTotalDevices = document.getElementById('stat-total-devices');
    const statActiveDevices = document.getElementById('stat-active-devices');
    const statInactiveDevices = document.getElementById('stat-inactive-devices');

    // Topology Elements
    const topologyCanvas = document.getElementById('topology-canvas');
    const refreshTopologyBtn = document.getElementById('refresh-topology');
    const centerTopologyBtn = document.getElementById('center-topology');

    // --- API Endpoints ---
    const API = {
        getDevices: 'api/get_switches.php',
        addDevice: 'api/add_switch.php',
        updateDevice: 'api/update_device.php',
        deleteDevice: 'api/delete_device.php',
        getLogs: 'api/get_logs.php',
        getErrorGuides: 'api/get_error_guides.php',
        addGuide: 'api/add_guide.php',
        updateGuide: 'api/update_guide.php',
        deleteGuide: 'api/delete_guide.php',
        getBuildings: 'api/get_buildings.php',
        addBuilding: 'api/add_building.php',
        getDashboardStats: 'api/get_dashboard_stats.php',
        getAlerts: 'api/get_alerts.php',
        resolveAlert: 'api/resolve_alert.php',
        getResolvedAlerts: 'api/get_resolved_alerts.php',
        getDeviceHistory: 'api/get_device_history.php',
        getUsers: 'api/get_users.php',
        addUser: 'api/add_user.php',
        deleteUser: 'api/delete_user.php',
        scheduleMaintenance: 'api/schedule_maintenance.php',
        getMaintenanceWindows: 'api/get_maintenance_windows.php',
        deleteMaintenanceWindow: 'api/delete_maintenance_window.php',
        logout: 'api/logout.php'
    };

    let buildingsCache = [];
    let devicesCache = [];
    let latencyChart = null;
    let currentTopologyData = null;
    let tooltip = null;

    // --- Navigation Logic ---
    function switchView(viewName) {
        views.forEach(view => view.classList.remove('active-view'));
        navLinks.forEach(link => link.classList.remove('active'));
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) targetView.classList.add('active-view');
        
        const targetLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);
        if (targetLink) targetLink.classList.add('active');
        
        if (viewName === 'admin') fetchAndDisplayUsers();
        if (viewName === 'maintenance') fetchAndDisplayMaintenanceWindows();
        if (viewName === 'topology') initializeTopology();
    }

    // --- Core Functions ---
    function initializeDashboard() {
        if (currentUserRole === 'admin') {
            document.getElementById('admin-nav-link').style.display = 'block';
            if (addGuideBtn) addGuideBtn.style.display = 'block';
        }
        if (currentUserRole === 'viewer') {
            const mgmtLink = document.querySelector('.nav-link[data-view="management"]');
            if (mgmtLink) mgmtLink.style.display = 'none';
            const maintLink = document.querySelector('.nav-link[data-view="maintenance"]');
            if (maintLink) maintLink.style.display = 'none';
        }
        fetchAndPopulateBuildings().then(() => fetchAndDisplayDevices());
        fetchAndDisplayLogs();
        fetchAndDisplayErrorGuides();
        fetchAndDisplayDashboardStats();
        fetchAndDisplayAlerts();
        fetchAndDisplayResolvedAlerts();
    }

    function refreshLiveData() {
        fetchAndDisplayDevices();
        fetchAndDisplayLogs();
        fetchAndDisplayDashboardStats();
        fetchAndDisplayAlerts();
        fetchAndDisplayResolvedAlerts();
        
        const maintView = document.getElementById('maintenance-view');
        if (maintView && maintView.classList.contains('active-view')) {
            fetchAndDisplayMaintenanceWindows();
        }
        
        // Refresh topology if it's the active view
        const topologyView = document.getElementById('topology-view');
        if (topologyView && topologyView.classList.contains('active-view')) {
            fetchAndDisplayTopology();
        }
    }
    
    async function fetchAndDisplayDevices() {
        try {
            const res = await fetch(API.getDevices);
            const result = await res.json();
            if (result.success) {
                updateDeviceTable(result.data);
                devicesCache = result.data.flatMap(group => group.devices);
                currentTopologyData = result.data; // Store for topology
                populateDeviceDropdown(maintenanceDeviceDropdown, devicesCache);
            }
        } catch (e) {
            console.error(e);
            displayConnectionError();
        }
    }

    // --- Network Topology Functions ---
    function initializeTopology() {
        if (!topologyCanvas) return;
        
        // Create tooltip if it doesn't exist
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'node-tooltip';
            document.body.appendChild(tooltip);
        }
        
        // Add event listeners for topology controls
        if (refreshTopologyBtn) {
            refreshTopologyBtn.removeEventListener('click', fetchAndDisplayTopology);
            refreshTopologyBtn.addEventListener('click', fetchAndDisplayTopology);
        }
        
        if (centerTopologyBtn) {
            centerTopologyBtn.removeEventListener('click', centerTopologyView);
            centerTopologyBtn.addEventListener('click', centerTopologyView);
        }
        
        fetchAndDisplayTopology();
    }

    async function fetchAndDisplayTopology() {
        try {
            // Use existing device data if available, otherwise fetch
            if (currentTopologyData) {
                renderTopology(currentTopologyData);
            } else {
                const res = await fetch(API.getDevices);
                const result = await res.json();
                if (result.success) {
                    currentTopologyData = result.data;
                    renderTopology(result.data);
                }
            }
        } catch (error) {
            console.error('Topology fetch error:', error);
            if (topologyCanvas) {
                topologyCanvas.innerHTML = '<div style="text-align: center; padding: 50px; color: var(--danger-color);">Failed to load topology data</div>';
            }
        }
    }

    function renderTopology(buildingGroups) {
        if (!topologyCanvas) return;
        
        // Clear existing content
        topologyCanvas.innerHTML = '';
        
        const containerRect = topologyCanvas.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        
        // Adjust positions for better layout
        const routerY = 60;
        const firewallY = 140;
        const centralSwitchY = 220;
        
        // Create network infrastructure nodes
        const nodes = [];
        const connections = [];
        
        // 1. Router (top of hierarchy)
        const router = createNetworkNode('router', 'RTR', centerX, routerY, 'Internet Router', 'Gateway to external network\nStatus: Connected');
        nodes.push(router);
        
        // 2. Firewall
        const firewall = createNetworkNode('firewall', 'FW', centerX, firewallY, 'Security Firewall', 'Network security gateway\nStatus: Active');
        nodes.push(firewall);
        
        // 3. Central Switch
        const centralSwitch = createNetworkNode('central-switch', 'CS', centerX, centralSwitchY, 'Central Switch', 'Main distribution switch\nManaging all building connections');
        nodes.push(centralSwitch);
        
        // Create connections for infrastructure
        connections.push(createConnection(centerX, routerY + 30, centerX, firewallY - 25, true)); // Router to Firewall
        connections.push(createConnection(centerX, firewallY + 25, centerX, centralSwitchY - 22, true)); // Firewall to Central Switch
        
        // 4. Building Switches (arranged in a circle around central switch)
        const validBuildings = buildingGroups.filter(bg => bg.building_name !== 'Unassigned Devices');
        const buildingCount = validBuildings.length;
        
        if (buildingCount > 0) {
            const radius = Math.min(250, Math.max(180, buildingCount * 20));
            const angleStep = (2 * Math.PI) / buildingCount;
            
            validBuildings.forEach((buildingGroup, index) => {
                const angle = index * angleStep - Math.PI / 2; // Start from top
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                
                // Determine building status based on devices
                let buildingStatus = 'active';
                let totalDevices = buildingGroup.devices.length;
                let activeDevices = buildingGroup.devices.filter(d => d.device_status == 1).length;
                let maintenanceDevices = buildingGroup.devices.filter(d => d.device_status == 2).length;
                let inactiveDevices = buildingGroup.devices.filter(d => d.device_status == 0).length;
                
                if (totalDevices === 0 || activeDevices === 0) {
                    buildingStatus = 'inactive';
                } else if (maintenanceDevices > 0) {
                    buildingStatus = 'maintenance';
                }
                
                const buildingSwitch = createNetworkNode(
                    `building-switch ${buildingStatus}`, 
                    `B${index + 1}`, 
                    x, 
                    y, 
                    `${buildingGroup.building_name}`,
                    `Building: ${buildingGroup.building_name}\nLocation: ${buildingGroup.building_location}\nDevices: ${activeDevices}/${totalDevices} online\nMaintenance: ${maintenanceDevices}\nOffline: ${inactiveDevices}`
                );
                
                // Store building data for click events
                buildingSwitch.dataset.buildingData = JSON.stringify(buildingGroup);
                buildingSwitch.dataset.buildingIndex = index + 1;
                nodes.push(buildingSwitch);
                
                // Create connection from central switch to building switch
                const connectionActive = buildingStatus !== 'inactive';
                connections.push(createConnection(centerX, centralSwitchY + 22, x, y, connectionActive));
            });
        }
        
        // Add all connections first (so they appear behind nodes)
        connections.forEach(conn => topologyCanvas.appendChild(conn));
        
        // Add all nodes
        nodes.forEach(node => {
            topologyCanvas.appendChild(node);
            
            // Add hover events
            node.addEventListener('mouseenter', (e) => showTooltip(e, node.dataset.tooltip));
            node.addEventListener('mouseleave', hideTooltip);
            node.addEventListener('mousemove', (e) => updateTooltipPosition(e));
            node.addEventListener('click', (e) => handleNodeClick(e, node));
        });
    }

    function createNetworkNode(className, label, x, y, title, tooltipText) {
        const node = document.createElement('div');
        node.className = `network-node ${className}`;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.transform = 'translate(-50%, -50%)';
        node.textContent = label;
        node.title = title;
        node.dataset.tooltip = tooltipText;
        return node;
    }

    function createConnection(x1, y1, x2, y2, isActive) {
        const connection = document.createElement('div');
        connection.className = `network-connection ${isActive ? '' : 'inactive'}`;
        
        const deltaX = x2 - x1;
        const deltaY = y2 - y1;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        
        connection.style.width = `${length}px`;
        connection.style.left = `${x1}px`;
        connection.style.top = `${y1}px`;
        connection.style.transformOrigin = '0 50%';
        connection.style.transform = `rotate(${angle}deg)`;
        
        return connection;
    }

    function showTooltip(event, text) {
        if (!tooltip) return;
        tooltip.innerHTML = text.replace(/\n/g, '<br>');
        updateTooltipPosition(event);
        tooltip.classList.add('show');
    }

    function updateTooltipPosition(event) {
        if (!tooltip) return;
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY - 10}px`;
    }

    function hideTooltip() {
        if (!tooltip) return;
        tooltip.classList.remove('show');
    }

    function handleNodeClick(event, node) {
        if (node.dataset.buildingData) {
            // Show building details
            const buildingData = JSON.parse(node.dataset.buildingData);
            showBuildingDetails(buildingData);
        } else if (node.classList.contains('central-switch')) {
            // Show central switch details
            showCentralSwitchDetails();
        } else if (node.classList.contains('firewall')) {
            // Show firewall status
            showFirewallDetails();
        } else if (node.classList.contains('router')) {
            // Show router details
            showRouterDetails();
        }
    }

    function showBuildingDetails(buildingData) {
        const modalHtml = `
            <div class="modal-overlay" id="building-details-modal" style="display: flex;">
                <div class="modal-content">
                    <span class="modal-close">&times;</span>
                    <h2>${escapeHTML(buildingData.building_name)}</h2>
                    <p><strong>Location:</strong> ${escapeHTML(buildingData.building_location || 'Not specified')}</p>
                    <h3>Devices in this building:</h3>
                    <div class="building-devices-list">
                        ${buildingData.devices.length > 0 ? buildingData.devices.map(device => {
                            let statusClass = device.device_status == 1 ? 'active' : device.device_status == 2 ? 'maintenance' : 'inactive';
                            let statusText = device.device_status == 1 ? 'Active' : device.device_status == 2 ? 'Maintenance' : 'Inactive';
                            return `
                                <div class="device-card ${device_statusClass}">
                                    <div class="device-name">${escapeHTML(device.name)}</div>
                                    <div class="device-details">
                                        <span class="device-ip">${escapeHTML(device.ip_address)}</span>
                                        <span class="device-status status-${device_statusClass}">${device_statusText}</span>
                                    </div>
                                    <div class="device-info">
                                        Model: ${escapeHTML(device.model || 'Unknown')}<br>
                                        Type: ${escapeHTML(device.switch_type || 'Switch')}
                                    </div>
                                </div>
                            `;
                        }).join('') : '<p>No devices in this building</p>'}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Add close event
        const modal = document.getElementById('building-details-modal');
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    function showCentralSwitchDetails() {
        const totalDevices = devicesCache.length;
        const activeDevices = devicesCache.filter(d => d.device_status == 1).length;
        const maintenanceDevices = devicesCache.filter(d => d.device_status == 2).length;
        const inactiveDevices = devicesCache.filter(d => d.device_status == 0).length;
        
        const modalHtml = `
            <div class="modal-overlay" id="central-switch-modal" style="display: flex;">
                <div class="modal-content">
                    <span class="modal-close">&times;</span>
                    <h2>Central Switch Overview</h2>
                    <div class="switch-stats">
                        <div class="stat">
                            <span class="stat-label">Total Managed Devices:</span>
                            <span class="stat-value">${totalDevices}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Active Devices:</span>
                            <span class="stat-value active">${activeDevices}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Maintenance Mode:</span>
                            <span class="stat-value maintenance">${maintenanceDevices}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Inactive Devices:</span>
                            <span class="stat-value inactive">${inactiveDevices}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Buildings Connected:</span>
                            <span class="stat-value">${buildingsCache.length}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.getElementById('central-switch-modal');
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    function showFirewallDetails() {
        const modalHtml = `
            <div class="modal-overlay" id="firewall-modal" style="display: flex;">
                <div class="modal-content">
                    <span class="modal-close">&times;</span>
                    <h2>Network Firewall Status</h2>
                    <div class="firewall-status">
                        <div class="status-item">
                            <span class="status-label">Status:</span>
                            <span class="status-value active">Active</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Security Level:</span>
                            <span class="status-value">High</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Blocked Threats (24h):</span>
                            <span class="status-value">247</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Last Update:</span>
                            <span class="status-value">${new Date().toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.getElementById('firewall-modal');
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    function showRouterDetails() {
        const modalHtml = `
            <div class="modal-overlay" id="router-modal" style="display: flex;">
                <div class="modal-content">
                    <span class="modal-close">&times;</span>
                    <h2>Internet Router Status</h2>
                    <div class="router-status">
                        <div class="status-item">
                            <span class="status-label">Connection:</span>
                            <span class="status-value active">Connected</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Uptime:</span>
                            <span class="status-value">15 days, 7 hours</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Bandwidth Usage:</span>
                            <span class="status-value">68% (680 Mbps / 1 Gbps)</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">External IP:</span>
                            <span class="status-value">203.0.113.42</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">DNS Status:</span>
                            <span class="status-value active">Operational</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.getElementById('router-modal');
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    function centerTopologyView() {
        if (!topologyCanvas) return;
        
        // Reset any transforms or scroll positions
        topologyCanvas.scrollTop = 0;
        topologyCanvas.scrollLeft = 0;
        
        // Re-render to ensure proper centering
        if (currentTopologyData) {
            renderTopology(currentTopologyData);
        }
    }

    // --- Device Management Functions ---
    function updateDeviceTable(buildingGroups) {
        if (!devicesTableBody) return;
        
        devicesTableBody.innerHTML = '';
        
        buildingGroups.forEach(group => {
            if (group.devices.length === 0) return;
            
            // Building header row
            const headerRow = document.createElement('tr');
            headerRow.className = 'building-header-row';
            headerRow.innerHTML = `
                <td colspan="5">
                    <strong>${escapeHTML(group.building_name)}</strong>
                    ${group.building_location ? ` - ${escapeHTML(group.building_location)}` : ''}
                </td>
            `;
            devicesTableBody.appendChild(headerRow);
            
            // Device rows
           group.devices.forEach(device => {
            const row = document.createElement('tr');
            row.className = 'device-row';
            
            // Determine the status class and text for the status badge.
            let statusClass, statusText;
            switch (device.device_status) {
                case 1:
                    statusClass = 'active';
                    statusText = 'Active';
                    break;
                case 2:
                    statusClass = 'maintenance';
                    statusText = 'Maintenance';
                    break;
                default:
                    statusClass = 'inactive';
                    statusText = 'Inactive';
                    break;
            }

            // Construct the row with 5 cells to match the <thead>.
            // Column order: Name, IP, Status, Reason/Latency, Actions.
            row.innerHTML = `
                <td>${escapeHTML(device.name)}</td>
                <td>${escapeHTML(device.ip_address)}</td>
                <td><span class="status-badge status-${statusClass}">${statusText}</span></td>
                <td>${escapeHTML(device.reason)}</td>
                <td class="actions-cell">
                    <div class="actions-cell-container">
                        ${currentUserRole !== 'viewer' ? `
                            <button class="btn btn-sm btn-primary edit-device-btn" data-device-id="${device.id}">Edit</button>
                            <button class="btn btn-sm btn-info history-btn" data-device-id="${device.id}">History</button>
                            <button class="btn btn-sm btn-danger delete-device-btn" data-device-id="${device.id}">Delete</button>
                        ` : `
                            <button class="btn btn-sm btn-info history-btn" data-device-id="${device.id}">History</button>
                        `}
                    </div>
                </td>
            `;
            
            devicesTableBody.appendChild(row);
        });
    });
        
        // Add event listeners for device actions
        attachDeviceEventListeners();
    }

    function attachDeviceEventListeners() {
        // Edit device buttons
        document.querySelectorAll('.edit-device-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.preventDefault();

        const deviceId = btn.dataset.deviceId;

        if (!deviceId) {
            alert('Device ID not found.');
            return;
        }

        // Optional: You can fetch device details from backend if needed
        // const res = await fetch(`${API.getDevice}?id=${deviceId}`);
        // const deviceData = await res.json();

        openEditDeviceModal(deviceId); // This should fill form fields inside modal
    });
});

        
        // Delete device buttons
        document.querySelectorAll('.delete-device-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.preventDefault();

        // Get the device ID from a data attribute on the button
        const deviceId = btn.dataset.deviceId;

        if (!deviceId) {
            alert('Device ID not found.');
            return;
        }

        const fd = new FormData();
        fd.append('device_id', deviceId);

        try {
            const res = await fetch(API.deleteDevice, {
                method: 'POST',
                body: fd
            });

            const result = await res.json();

            if (result.success) {
                showNotification('Device deleted successfully', 'success');
                refreshLiveData();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (err) {
            alert('Error deleting device.');
        }
    });
});

        
        // History buttons
        document.querySelectorAll('.history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceId = e.target.dataset.deviceId;
                showDeviceHistory(deviceId);
            });
        });
    }

    async function openEditDeviceModal(deviceId) {
        const device = devicesCache.find(d => d.id == deviceId);
        if (!device || !editDeviceModal) return;
        
        // Populate form
        document.getElementById('edit-device-id').value = device.id;
        document.getElementById('edit-device-name').value = device.switch_name;
        document.getElementById('edit-ip-address').value = device.ip_address;
        // document.getElementById('edit-device-model').value = device.model || '';
        // document.getElementById('edit-device-type').value = device.switch_type || '';
        // document.getElementById('edit-device-status').value = device.status;
        
        // Populate building dropdown
        const buildingSelect = document.getElementById('edit-device-building');
        buildingSelect.innerHTML = '<option value="">Select Building</option>';
        buildingsCache.forEach(building => {
            const option = document.createElement('option');
            option.value = building.id;
            option.textContent = building.name;
            if (building.id == device.building_id) {
                option.selected = true;
            }
            buildingSelect.appendChild(option);
        });
        
        editDeviceModal.style.display = 'flex';
    }

    async function deleteDevice(deviceId) {
        if (!confirm('Are you sure you want to delete this device?')) return;
        
        try {
            const res = await fetch(API.deleteDevice, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: deviceId })
            });
            
            const result = await res.json();
            if (result.success) {
                showNotification('Device deleted successfully', 'success');
                fetchAndDisplayDevices();
            } else {
                showNotification(result.message || 'Failed to delete device', 'error');
            }
        } catch (error) {
            showNotification('Error deleting device', 'error');
        }
    }

    async function showDeviceHistory(deviceId) {
        if (!historyChartModal) return;
        
        try {
            const res = await fetch(`${API.getDeviceHistory}?device_id=${deviceId}`);
            const result = await res.json();
            
            if (result.success && result.data.length > 0) {
                renderLatencyChart(result.data);
                historyChartModal.style.display = 'flex';
            } else {
                showNotification('No history data available for this device', 'info');
            }
        } catch (error) {
            showNotification('Error loading device history', 'error');
        }
    }

    function renderLatencyChart(data) {
        if (!latencyChartCanvas) return;
        
        const ctx = latencyChartCanvas.getContext('2d');
        
        // Destroy existing chart
        if (latencyChart) {
            latencyChart.destroy();
        }
        
        // Prepare chart data
        const labels = data.map(entry => new Date(entry.timestamp).toLocaleString());
        const latencyData = data.map(entry => parseFloat(entry.latency) || 0);
        const uptimeData = data.map(entry => parseFloat(entry.uptime) || 0);
        
        // Create new chart
        latencyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Latency (ms)',
                    data: latencyData,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    yAxisID: 'y'
                }, {
                    label: 'Uptime (%)',
                    data: uptimeData,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Latency (ms)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Uptime (%)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    // --- Building Management Functions ---
    async function fetchAndPopulateBuildings() {
        try {
            const res = await fetch(API.getBuildings);
            const result = await res.json();
            
            if (result.success) {
                buildingsCache = result.data;
                populateBuildingDropdowns();
            }
        } catch (error) {
            console.error('Error fetching buildings:', error);
        }
    }

    function populateBuildingDropdowns() {
        const dropdowns = [buildingSelectDropdown, document.getElementById('edit-device-building')];
        
        dropdowns.forEach(dropdown => {
            if (!dropdown) return;
            
            dropdown.innerHTML = '<option value="">Select Building</option>';
            buildingsCache.forEach(building => {
                const option = document.createElement('option');
                option.value = building.id;
                option.textContent = building.name;
                dropdown.appendChild(option);
            });
        });
    }

    function populateDeviceDropdown(dropdown, devices) {
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">Select Device</option>';
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = `${device.switch_name} (${device.ip_address})`;
            dropdown.appendChild(option);
        });
    }

    // --- Log Management Functions ---
    async function fetchAndDisplayLogs() {
        try {
            const res = await fetch(API.getLogs);
            const result = await res.json();
            
            if (result.success ) {
                displayLogs(result.data);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    }

    function displayLogs(logs) {
        if (!logsContainer) return;
        
        logsContainer.innerHTML = '';
        
        if (logs.length === 0) {
            logsContainer.innerHTML = '<p class="no-data">No logs available</p>';
            return;
        }
        
        logs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-${log.level}`;
            
            const timestamp = new Date(log.timestamp).toLocaleString();
            
            logEntry.innerHTML = `
                <div class="log-header">
                    <span class="log-timestamp">${timestamp}</span>
                    <span class="log-level">${escapeHTML(log.level)}</span>
                    <span class="log-device">${escapeHTML(log.device_name || 'Unknown')}</span>
                </div>
                <div class="log-message">${escapeHTML(log.message)}</div>
            `;
            
            logsContainer.appendChild(logEntry);
        });
    }
// --- Error Guide Functions ---

async function fetchAndDisplayErrorGuides() {
    try {
        const res = await fetch(API.getErrorGuides);
        const result = await res.json();

        if (result.success) {
            renderErrorGuides(result.data);
        } else {
            console.warn('Failed to fetch error guides:', result.message || 'Unknown error');
        }
    } catch (error) {
        console.error('Error fetching error guides:', error);
    }
}

function renderErrorGuides(guides) {
    if (!errorGuidesContainer) return;

    errorGuidesContainer.innerHTML = '';

    if (!Array.isArray(guides) || guides.length === 0) {
        errorGuidesContainer.innerHTML = `
            <div class="no-data">No error guides available</div>
        `;
        return;
    }

    guides.forEach(guide => {
        const { id, error_code, description, solution } = guide;

        const guideCard = document.createElement('div');
        guideCard.className = 'error-guide-card';

        const adminControls = currentUserRole === 'admin' ? `
            <div class="guide-actions">
                <button class="btn btn-sm btn-secondary edit-guide-btn" data-guide-id="${id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-guide-btn" data-guide-id="${id}">Delete</button>
            </div>
        ` : '';

        guideCard.innerHTML = `
            <div class="guide-header">
                <h4>${escapeHTML(error_code)}</h4>
                ${adminControls}
            </div>
            <div class="guide-description">${escapeHTML(description)}</div>
            <div class="guide-solution">
                <strong>Solution:</strong>
                <div>${escapeHTML(solution)}</div>
            </div>
        `;

        errorGuidesContainer.appendChild(guideCard);
    });

        
        // Add event listeners for guide management
        if (currentUserRole === 'admin') {
            attachGuideEventListeners();
        }
    }

    function attachGuideEventListeners() {
        document.querySelectorAll('.edit-guide-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const guideId = e.target.dataset.guideId;
                openEditGuideModal(guideId);
            });
        });
        
        document.querySelectorAll('.delete-guide-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const guideId = e.target.dataset.guideId;
                deleteGuide(guideId);
            });
        });
    }

    async function openEditGuideModal(guideId) {
        // Implementation for editing guides
        if (!guideModal) return;
        
        try {
            const res = await fetch(`${API.getErrorGuides}?id=${guideId}`);
            const result = await res.json();
            
            if (result.success && result.data.length > 0) {
                const guide = result.data[0];
                
                document.getElementById('guide-error-code').value = guide.error_code;
                document.getElementById('guide-description').value = guide.description;
                document.getElementById('guide-solution').value = guide.solution;
                document.getElementById('guide-id').value = guide.id;
                
                guideModal.style.display = 'flex';
            }
        } catch (error) {
            showNotification('Error loading guide data', 'error');
        }
    }

    async function deleteGuide(guideId) {
    const userConfirmed = confirm('Are you sure you want to delete this guide?');
    if (!userConfirmed) return;

    try {
        const response = await fetch(API.deleteGuide, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: guideId })
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Guide deleted successfully', 'success');
            fetchAndDisplayErrorGuides();
        } else {
            const message = result.message || 'Failed to delete guide';
            showNotification(message, 'error');
            console.warn('Guide deletion failed:', result);
        }
    } catch (error) {
        console.error('Error deleting guide:', error);
        showNotification('Error deleting guide', 'error');
    }
}


    // --- Dashboard Stats Functions ---
    async function fetchAndDisplayDashboardStats() {
        try {
            const res = await fetch(API.getDashboardStats);
            const result = await res.json();
            
            if (result.success) {
                updateDashboardStats(result.data);
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        }
    }

    function updateDashboardStats(stats) {
        if (statTotalBuildings) statTotalBuildings.textContent = stats.total_buildings || 0;
        if (statTotalDevices) statTotalDevices.textContent = stats.total_devices || 0;
        if (statActiveDevices) statActiveDevices.textContent = stats.active_devices || 0;
        if (statInactiveDevices) statInactiveDevices.textContent = stats.inactive_devices || 0;
    }

    // --- Alert Management Functions ---
    async function fetchAndDisplayAlerts() {
        try {
            const res = await fetch(API.getAlerts);
            const result = await res.json();
            
            if (result.success && activeAlertsContainer) {
                displayAlerts(result.data);
            }
        } catch (error) {
            console.error('Error fetching alerts:', error);
        }
    }

    function displayAlerts(alerts) {
        if (!activeAlertsContainer) return;
        
        activeAlertsContainer.innerHTML = '';
        
        if (alerts.length === 0) {
            activeAlertsContainer.innerHTML = '<p class="no-data">No active alerts</p>';
            return;
        }
        
        alerts.forEach(alert => {
            const alertCard = document.createElement('div');
            alertCard.className = `alert-card alert-${alert.severity}`;
            
            const timestamp = new Date(alert.created_at).toLocaleString();
            
            alertCard.innerHTML = `
                <div class="alert-header">
                    <span class="alert-severity">${escapeHTML(alert.severity)}</span>
                    <span class="alert-timestamp">${timestamp}</span>
                </div>
                <div class="alert-message">${escapeHTML(alert.message)}</div>
                <div class="alert-device">Device: ${escapeHTML(alert.device_name || 'Unknown')}</div>
                ${currentUserRole !== 'viewer' ? `
                    <div class="alert-actions">
                        <button class="btn btn-sm btn-success resolve-alert-btn" data-alert-id="${alert.id}">Resolve</button>
                    </div>
                ` : ''}
            `;
            
            activeAlertsContainer.appendChild(alertCard);
        });
        
        // Add event listeners for alert resolution
        if (currentUserRole !== 'viewer') {
            attachAlertEventListeners();
        }
    }

    function attachAlertEventListeners() {
        document.querySelectorAll('.resolve-alert-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const alertId = e.target.dataset.alertId;
                resolveAlert(alertId);
            });
        });
    }

   // Correct JS call using alert_id key
async function resolveAlert(alertId) {
    console.log("Sending alert_id:", alertId); // Debug

    try {
        const res = await fetch(API.resolveAlert, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ alert_id: alertId })  // MUST be 'alert_id'
        });

        const result = await res.json();
        console.log("Resolve response:", result);

        if (result.success) {
            showNotification('Alert resolved successfully', 'success');
            fetchAndDisplayAlerts();
            fetchAndDisplayResolvedAlerts();
        } else {
            showNotification(result.message || 'Failed to resolve alert', 'error');
        }
    } catch (error) {
        showNotification('Error resolving alert', 'error');
    }
}

    async function fetchAndDisplayResolvedAlerts() {
        try {
            const res = await fetch(API.getResolvedAlerts);
            const result = await res.json();
            
            if (result.success && resolvedAlertsTbody) {
                displayResolvedAlerts(result.data);
            }
        } catch (error) {
            console.error('Error fetching resolved alerts:', error);
        }
    }

   function displayResolvedAlerts(alerts) {
    if (!resolvedAlertsTbody) return;
    
    resolvedAlertsTbody.innerHTML = '';
    
    if (alerts.length === 0) {
        resolvedAlertsTbody.innerHTML = '<tr><td colspan="4" class="no-data">No resolved alerts</td></tr>';
        return;
    }
    
    alerts.forEach(alert => {
        const row = document.createElement('tr');
        
        const createdAt = new Date(alert.created_at).toLocaleString();
        const resolvedAt = new Date(alert.resolved_at).toLocaleString();
        
        // Use the correct field names from PHP response
        const severity = alert.severity || 'medium';
        const description = alert.description || alert.title || 'No description';
        const deviceName = alert.device_name || 'Unknown';
        
        row.innerHTML = `
            <td>${escapeHTML(description)}</td>
            <td>${escapeHTML(deviceName)}</td>
            <td>${createdAt}</td>
            <td>${resolvedAt}</td>
        `;
        
        resolvedAlertsTbody.appendChild(row);
    });
}

    // --- User Management Functions ---
    async function fetchAndDisplayUsers() {
        if (currentUserRole !== 'admin' || !usersTableBody) return;
        
        try {
            const res = await fetch(API.getUsers);
            const result = await res.json();
            
            if (result.success) {
                displayUsers(result.data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }

    function displayUsers(users) {
        if (!usersTableBody) return;
        
        usersTableBody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${escapeHTML(user.username)}</td>
                <td>${escapeHTML(user.email || 'N/A')}</td>
                <td><span class="role-badge role-${user.role}">${escapeHTML(user.role)}</span></td>
                <td>${new Date(user.created_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-danger delete-user-btn" data-user-id="${user.id}" ${user.username === 'admin' ? 'disabled' : ''}>Delete</button>
                </td>
            `;
            
            usersTableBody.appendChild(row);
        });
        
        // Add event listeners for user deletion
        attachUserEventListeners();
    }

    function attachUserEventListeners() {
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                deleteUser(userId);
            });
        });
    }

    async function deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) return;
        
        try {
            const res = await fetch(API.deleteUser, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId })
            });
            
            const result = await res.json();
            if (result.success) {
                showNotification('User deleted successfully', 'success');
                fetchAndDisplayUsers();
            } else {
                showNotification(result.message || 'Failed to delete user', 'error');
            }
        } catch (error) {
            showNotification('Error deleting user', 'error');
        }
    }

    // --- Maintenance Management Functions ---
    async function fetchAndDisplayMaintenanceWindows() {
        try {
            const res = await fetch(API.getMaintenanceWindows);
            const result = await res.json();
            
            if (result.success && maintenanceTableBody) {
                displayMaintenanceWindows(result.data);
            }
        } catch (error) {
            console.error('Error fetching maintenance windows:', error);
        }
    }

    function displayMaintenanceWindows(windows) {
        if (!maintenanceTableBody) return;
        
        maintenanceTableBody.innerHTML = '';
        
        if (windows.length === 0) {
            maintenanceTableBody.innerHTML = '<tr><td colspan="6" class="no-data">No maintenance windows scheduled</td></tr>';
            return;
        }
        
        windows.forEach(window => {
            const row = document.createElement('tr');
            
            const startTime = new Date(window.start_time).toLocaleString();
            const endTime = new Date(window.end_time).toLocaleString();
            const now = new Date();
            const windowStart = new Date(window.start_time);
            const windowEnd = new Date(window.end_time);
            
            let device_status = 'scheduled';
            if (now >= windowStart && now <= windowEnd) {
                device_status = 'active';
            } else if (now > windowEnd) {
                device_status = 'completed';
            }
            
            row.innerHTML = `
                <td>${escapeHTML(window.device_name)}</td>
                <td>${escapeHTML(window.description)}</td>
                <td>${startTime}</td>
                <td>${endTime}</td>
                <td><span class="maintenance-status status-${device_status}">${device_status}</span></td>
                <td>
                    ${currentUserRole !== 'viewer' && device_status === 'scheduled' ? `
                        <button class="btn btn-sm btn-danger delete-maintenance-btn" data-maintenance-id="${window.id}">Cancel</button>
                    ` : ''}
                </td>
            `;
            
            maintenanceTableBody.appendChild(row);
        });
        
        // Add event listeners for maintenance deletion
        if (currentUserRole !== 'viewer') {
            attachMaintenanceEventListeners();
        }
    }

    function attachMaintenanceEventListeners() {
        document.querySelectorAll('.delete-maintenance-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const maintenanceId = e.target.dataset.maintenanceId;
                deleteMaintenanceWindow(maintenanceId);
            });
        });
    }

    async function deleteMaintenanceWindow(maintenanceId) {
        if (!confirm('Are you sure you want to cancel this maintenance window?')) return;
        
        try {
            const res = await fetch(API.deleteMaintenanceWindow, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: maintenanceId })
            });
            
            const result = await res.json();
            if (result.success) {
                showNotification('Maintenance window cancelled successfully', 'success');
                fetchAndDisplayMaintenanceWindows();
            } else {
                showNotification(result.message || 'Failed to cancel maintenance window', 'error');
            }
        } catch (error) {
            showNotification('Error cancelling maintenance window', 'error');
        }
    }

    // --- Utility Functions ---
    function escapeHTML(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function displayConnectionError() {
        if (devicesTableBody) {
            devicesTableBody.innerHTML = '<tr><td colspan="6" class="error-message">Failed to load devices. Please check your connection.</td></tr>';
        }
    }

    // --- Form Event Listeners ---
    if (addBuildingForm) {
        addBuildingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fd = new FormData(addBuildingForm);
            
            
            try {
                const res = await fetch(API.addBuilding, {
                    method: 'POST',
                    body: fd
                });
                
                const result = await res.json();
                if (result.success) {
                    showNotification('Building added successfully', 'success');
                    e.target.reset();
                    fetchAndPopulateBuildings();
                } else {
                    showNotification(result.message || 'Failed to add building', 'error');
                }
            } catch (error) {
                showNotification('Error adding building', 'error');
            }
        });
    }

    if (addDeviceForm) {
    addDeviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fd = new FormData(addDeviceForm);
        
        try {
            const res = await fetch(API.addDevice, {
                method: 'POST',
                body: fd
            });
            const result = await res.json();
            if (result.success) {
                showNotification('Device added successfully', 'success');
                addDeviceForm.reset();
                document.getElementById('reason-group').style.display = 'none';
                refreshLiveData();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (err) {
            alert('Error adding device.');
        }
    });
}

if (editDeviceForm) {
    editDeviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(editDeviceForm);

        try {
            const res = await fetch('api/update_device.php', {
                method: 'POST',
                body: fd
            });

            const result = await res.json();

            if (result.success) {
                showNotification('Device updated successfully!');
                closeEditModal(); // optional
                refreshLiveData(); // optional
            } else {
                alert('Error: ' + result.message);
            }

        } catch (err) {
            console.log("hello")
        }
    });


}

if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value.trim();
        const role = document.getElementById('new-user-role').value;

        const userData = { username, password, role };

        try {
            const res = await fetch('api/add_user.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const result = await res.json();
            if (result.success) {
                showNotification('User added successfully!', 'success');
                addUserForm.reset();
                fetchAndDisplayUsers();
            } else {
                showNotification(result.message || 'Failed to add user.', 'error');
            }
        } catch (err) {
            showNotification('Error adding user.', 'error');
            console.error(err);
        }
    });
}


if (scheduleMaintenanceForm) {
    scheduleMaintenanceForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);

        try {
            const res = await fetch(API.scheduleMaintenance, {
                method: 'POST',
                body: formData  // No JSON.stringify, no headers
            });

            const result = await res.json();

            if (result.success) {
                showNotification('Maintenance window scheduled successfully', 'success');
                e.target.reset();
                fetchAndDisplayMaintenanceWindows();
            } else {
                showNotification(result.message || 'Failed to schedule maintenance', 'error');
            }
        } catch (error) {
            showNotification('Error scheduling maintenance', 'error');
        }
    
        });
    }
guideForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);

    const payload = {
        error_code: formData.get('error-code')?.trim(),
        description: formData.get('description')?.trim(),
        solution: formData.get('solution')?.trim()
    };

    console.log("Sending payload:", payload); // 🧪 DEBUG

  const res=await fetch("api/add_guide.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        error_code: "ERR404",
        title: "Page Not Found",
        description: "User tried to access a missing page.",
        solution: "Check the URL or contact admin."
    })
});


const result = await res.json();  // THIS will fail if response is not JSON

    console.log(result); // 🧪 DEBUG

    if (result.success) {
        showNotification("Guide added!");
        guideForm.reset();
    } else {
        alert("Error: " + result.message);
    }
});


    // --- Search Functionality ---
    if (errorSearchInput) {
        errorSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const guideCards = document.querySelectorAll('.error-guide-card');
            
            guideCards.forEach(card => {
                const errorCode = card.querySelector('h4').textContent.toLowerCase();
                const description = card.querySelector('.guide-description').textContent.toLowerCase();
                const solution = card.querySelector('.guide-solution').textContent.toLowerCase();
                
                const matches = errorCode.includes(searchTerm) || 
                               description.includes(searchTerm) || 
                               solution.includes(searchTerm);
                
                card.style.display = matches ? 'block' : 'none';
            });
        });
    }

    // --- Navigation Event Listeners ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = e.target.dataset.view;
            if (viewName) {
                switchView(viewName);
            }
        });
    });

    // --- Modal Event Listeners ---
    if (addGuideBtn && guideModal) {
        addGuideBtn.addEventListener('click', () => {
            document.getElementById('guide-id').value = '';
            guideForm.reset();
            guideModal.style.display = 'flex';
        });
    }

    // Close modals
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
            const modal = e.target.closest('.modal-overlay') || e.target.parentElement.closest('.modal-overlay');
            if (modal) {
                modal.style.display = 'none';
            }
        }
    });

    // --- Logout Event Listener ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await fetch(API.logout, { method: 'POST' });
                window.location.replace('login.html');
            } catch (error) {
                window.location.replace('login.html');
            }
        });
    }

    // --- Auto-refresh Setup ---
    setInterval(refreshLiveData, 30000); // Refresh every 30 seconds

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + R to refresh data
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            refreshLiveData();
            showNotification('Data refreshed manually', 'info');
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal-overlay[style*="flex"]');
            openModals.forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });

    // --- Responsive Design Handlers ---
    function handleResize() {
        // Re-render topology if it's visible and topology data exists
        const topologyView = document.getElementById('topology-view');
        if (topologyView && topologyView.classList.contains('active-view') && currentTopologyData) {
            setTimeout(() => renderTopology(currentTopologyData), 100);
        }
    }

    window.addEventListener('resize', handleResize);

    // --- Error Handling for Network Issues ---
    window.addEventListener('online', () => {
        showNotification('Connection restored', 'success');
        refreshLiveData();
    });

    window.addEventListener('offline', () => {
        showNotification('Connection lost - data may be outdated', 'warning');
    });

    // --- Performance Optimization ---
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Debounced search to improve performance
    if (errorSearchInput) {
        const debouncedSearch = debounce((searchTerm) => {
            const guideCards = document.querySelectorAll('.error-guide-card');
            
            guideCards.forEach(card => {
                const errorCode = card.querySelector('h4').textContent.toLowerCase();
                const description = card.querySelector('.guide-description').textContent.toLowerCase();
                const solution = card.querySelector('.guide-solution').textContent.toLowerCase();
                
                const matches = errorCode.includes(searchTerm) || 
                               description.includes(searchTerm) || 
                               solution.includes(searchTerm);
                
                card.style.display = matches ? 'block' : 'none';
            });
        }, 300);

        errorSearchInput.removeEventListener('input', errorSearchInput._searchHandler);
        errorSearchInput._searchHandler = (e) => debouncedSearch(e.target.value.toLowerCase());
        errorSearchInput.addEventListener('input', errorSearchInput._searchHandler);
    }

    // --- Data Export Functions ---
    function exportDevicesData() {
        if (devicesCache.length === 0) {
            showNotification('No device data to export', 'warning');
            return;
        }

        const csvContent = generateDevicesCSV(devicesCache);
        downloadCSV(csvContent, 'devices_export.csv');
        showNotification('Device data exported successfully', 'success');
    }

    function generateDevicesCSV(devices) {
        const headers = ['Device Name', 'IP Address', 'Model', 'Type', 'Status', 'Building'];
        const rows = devices.map(device => [
            device.switch_name || '',
            device.ip_address || '',
            device.model || '',
            device.switch_type || '',
            device.device_status == 1 ? 'Active' : device.device_status == 2 ? 'Maintenance' : 'Inactive',
            device.building_name || 'Unassigned'
        ]);

        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }

    function downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // --- Add export button functionality ---
    const exportBtn = document.getElementById('export-devices-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportDevicesData);
    }

    // --- Theme Toggle (if implemented) ---
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            showNotification(`Switched to ${isDark ? 'dark' : 'light'} theme`, 'info');
        });

        // Load saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
    }

    // --- Advanced Search Functionality ---
    function setupAdvancedSearch() {
        const searchOptions = document.getElementById('search-options');
        const deviceFilter = document.getElementById('device-filter');
        const statusFilter = document.getElementById('status-filter');
        const buildingFilter = document.getElementById('building-filter');

        if (deviceFilter) {
            deviceFilter.addEventListener('change', filterDevices);
        }
        if (statusFilter) {
            statusFilter.addEventListener('change', filterDevices);
        }
        if (buildingFilter) {
            buildingFilter.addEventListener('change', filterDevices);
        }
    }

    function filterDevices() {
        const nameFilter = document.getElementById('device-filter')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('status-filter')?.value || '';
        const buildingFilter = document.getElementById('building-filter')?.value || '';

        const deviceRows = document.querySelectorAll('.device-row');
        
        deviceRows.forEach(row => {
            const deviceName = row.children[0].textContent.toLowerCase();
            const statusBadge = row.querySelector('.status-badge');
            const deviceStatus = statusBadge ? statusBadge.textContent.toLowerCase() : '';
            
            // Get building from the previous building header
            let buildingName = '';
            let prevElement = row.previousElementSibling;
            while (prevElement) {
                if (prevElement.classList.contains('building-header')) {
                    buildingName = prevElement.textContent.toLowerCase();
                    break;
                }
                prevElement = prevElement.previousElementSibling;
            }

            const nameMatch = nameFilter === '' || deviceName.includes(nameFilter);
            const statusMatch = statusFilter === '' || deviceStatus.includes(statusFilter.toLowerCase());
            const buildingMatch = buildingFilter === '' || buildingName.includes(buildingFilter.toLowerCase());

            row.style.display = nameMatch && statusMatch && buildingMatch ? '' : 'none';
        });
    }

    // --- Bulk Operations ---
    function setupBulkOperations() {
        const selectAllCheckbox = document.getElementById('select-all-devices');
        const bulkActionsPanel = document.getElementById('bulk-actions-panel');
        const bulkStatusBtn = document.getElementById('bulk-status-btn');
        const bulkMaintenanceBtn = document.getElementById('bulk-maintenance-btn');
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const deviceCheckboxes = document.querySelectorAll('.device-checkbox');
                deviceCheckboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
                updateBulkActionsVisibility();
            });
        }

        // Add event listeners for individual checkboxes (dynamically created)
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('device-checkbox')) {
                updateBulkActionsVisibility();
            }
        });

        if (bulkStatusBtn) {
            bulkStatusBtn.addEventListener('click', performBulkStatusUpdate);
        }
        if (bulkMaintenanceBtn) {
            bulkMaintenanceBtn.addEventListener('click', scheduleBulkMaintenance);
        }
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', performBulkDelete);
        }
    }

    function updateBulkActionsVisibility() {
        const selectedDevices = document.querySelectorAll('.device-checkbox:checked');
        const bulkActionsPanel = document.getElementById('bulk-actions-panel');
        
        if (bulkActionsPanel) {
            bulkActionsPanel.style.display = selectedDevices.length > 0 ? 'block' : 'none';
        }
    }

    function getSelectedDeviceIds() {
        const selectedCheckboxes = document.querySelectorAll('.device-checkbox:checked');
        return Array.from(selectedCheckboxes).map(checkbox => checkbox.value);
    }

    async function performBulkStatusUpdate() {
        const deviceIds = getSelectedDeviceIds();
        if (deviceIds.length === 0) return;

        const newStatus = prompt('Enter new status (0=Inactive, 1=Active, 2=Maintenance):');
        if (newStatus === null || !['0', '1', '2'].includes(newStatus)) return;

        try {
            const promises = deviceIds.map(id => 
                fetch(API.updateDevice, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, status: newStatus })
                })
            );

            await Promise.all(promises);
            showNotification(`Updated ${deviceIds.length} devices successfully`, 'success');
            fetchAndDisplayDevices();
        } catch (error) {
            showNotification('Error updating devices', 'error');
        }
    }

    async function scheduleBulkMaintenance() {
        const deviceIds = getSelectedDeviceIds();
        if (deviceIds.length === 0) return;

        const description = prompt('Enter maintenance description:');
        if (!description) return;

        const startTime = prompt('Enter start time (YYYY-MM-DD HH:MM):');
        if (!startTime) return;

        const endTime = prompt('Enter end time (YYYY-MM-DD HH:MM):');
        if (!endTime) return;

        try {
            const promises = deviceIds.map(deviceId => 
                fetch(API.scheduleMaintenance, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        device_id: deviceId,
                        description,
                        start_time: startTime,
                        end_time: endTime
                    })
                })
            );

            await Promise.all(promises);
            showNotification(`Scheduled maintenance for ${deviceIds.length} devices`, 'success');
            fetchAndDisplayMaintenanceWindows();
        } catch (error) {
            showNotification('Error scheduling maintenance', 'error');
        }
    }

    async function performBulkDelete() {
        const deviceIds = getSelectedDeviceIds();
        if (deviceIds.length === 0) return;

        if (!confirm(`Are you sure you want to delete ${deviceIds.length} devices?`)) return;

        try {
            const promises = deviceIds.map(id => 
                fetch(API.deleteDevice, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                })
            );

            await Promise.all(promises);
            showNotification(`Deleted ${deviceIds.length} devices successfully`, 'success');
            fetchAndDisplayDevices();
        } catch (error) {
            showNotification('Error deleting devices', 'error');
        }
    }

    // --- Initialize Everything ---
    try {
        initializeDashboard();
        setupAdvancedSearch();
        setupBulkOperations();
        
        // Set default view
        switchView('dashboard');
        
        console.log('Dashboard initialized successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error initializing dashboard', 'error');
    }

    // --- Expose some functions globally for debugging ---
    window.dashboardAPI = {
        refreshData: refreshLiveData,
        switchView: switchView,
        exportDevices: exportDevicesData,
        showNotification: showNotification
    };



function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

function renderErrorGuides(guides) {
    if (!errorGuidesContainer) return;

    errorGuidesContainer.innerHTML = '';

    if (!Array.isArray(guides) || guides.length === 0) {
        errorGuidesContainer.innerHTML = `<div class="no-data">No error guides available</div>`;
        return;
    }

    guides.forEach(guide => {
        const { id, error_code, description, solution } = guide;

        const guideCard = document.createElement('div');
        guideCard.className = 'error-guide-card';

        const adminControls = currentUserRole === 'admin' ? `
            <div class="guide-actions">
                <button class="btn btn-sm btn-secondary edit-guide-btn" data-guide-id="${id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-guide-btn" data-guide-id="${id}">Delete</button>
            </div>
        ` : '';

        guideCard.innerHTML = `
            <div class="guide-header">
                <h4>${escapeHTML(error_code)}</h4>
                ${adminControls}
            </div>
            <div class="guide-description">${escapeHTML(description)}</div>
            <div class="guide-solution"><strong>Solution:</strong><div>${escapeHTML(solution)}</div></div>
        `;

        errorGuidesContainer.appendChild(guideCard);
    });
}

// simulate fetch
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/get_error_guides.php')
        .then(res => res.json())
        .then(data => {
            console.log('Error Guides:', data);
            if (data.success) renderErrorGuides(data.data);
        });
});
function checkStatus() {
    const ipAddress = document.getElementById('ip-input').value;
    const statusElement = document.getElementById('status-result');

    // Update your code to call the new script
    fetch(`/api/check_live_status.php?ip_address=${ipAddress}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.status === 'active') {
                    statusElement.textContent = `Active (${data.latency}ms)`;
                    statusElement.style.color = 'green';
                } else {
                    statusElement.textContent = 'Inactive';
                    statusElement.style.color = 'red';
                }
            } else {
                statusElement.textContent = `Error: ${data.message}`;
                statusElement.style.color = 'orange';
            }
        })
        .catch(error => {
            statusElement.textContent = 'Failed to check status.';
            console.error('Error:', error);
        });
}

// --- Network Topology Functions (Fixed) ---
function initializeTopology() {
    if (!topologyCanvas) {
        console.error('Topology canvas not found');
        return;
    }
    
    // Create tooltip if it doesn't exist
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'node-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.2s;
        `;
        document.body.appendChild(tooltip);
    }
    
    // Setup topology control buttons with proper event handling
    setupTopologyControls();
    
    // Initial load of topology
    fetchAndDisplayTopology();
}

function setupTopologyControls() {
    const refreshBtn = document.getElementById('refresh-topology');
    const centerBtn = document.getElementById('center-topology');
    
    if (refreshBtn) {
        // Remove any existing event listeners
        refreshBtn.replaceWith(refreshBtn.cloneNode(true));
        const newRefreshBtn = document.getElementById('refresh-topology');
        
        newRefreshBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Refresh topology button clicked');
            
            // Show loading indicator
            if (topologyCanvas) {
                topologyCanvas.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 400px; color: var(--primary-color);"><div>🔄 Refreshing topology...</div></div>';
            }
            
            // Force refresh topology data
            currentTopologyData = null;
            fetchAndDisplayTopology();
            showNotification('Topology refreshed', 'info');
        });
        
        console.log('Refresh button event listener attached');
    } else {
        console.error('Refresh topology button not found');
    }
    
    if (centerBtn) {
        // Remove any existing event listeners
        centerBtn.replaceWith(centerBtn.cloneNode(true));
        const newCenterBtn = document.getElementById('center-topology');
        
        newCenterBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Center topology button clicked');
            centerTopologyView();
            showNotification('View centered', 'info');
        });
        
        console.log('Center button event listener attached');
    } else {
        console.error('Center topology button not found');
    }
}

async function fetchAndDisplayTopology() {
    console.log('Fetching topology data...');
    
    try {
        // Always fetch fresh data when explicitly requested
        const res = await fetch(API.getDevices + '?timestamp=' + Date.now());
        const result = await res.json();
        
        if (result.success) {
            currentTopologyData = result.data;
            console.log('Topology data fetched:', result.data);
            renderTopology(result.data);
        } else {
            throw new Error(result.message || 'Failed to fetch topology data');
        }
    } catch (error) {
        console.error('Topology fetch error:', error);
        if (topologyCanvas) {
            topologyCanvas.innerHTML = `
                <div style="text-align: center; padding: 50px; color: var(--danger-color);">
                    <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                    <div>Failed to load topology data</div>
                    <div style="font-size: 12px; margin-top: 5px; opacity: 0.7;">${error.message}</div>
                    <button onclick="fetchAndDisplayTopology()" style="margin-top: 15px; padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
                </div>
            `;
        }
    }
}

function renderTopology(buildingGroups) {
    if (!topologyCanvas) {
        console.error('Topology canvas not available for rendering');
        return;
    }
    
    console.log('Rendering topology with data:', buildingGroups);
    
    // Clear existing content
    topologyCanvas.innerHTML = '';
    topologyCanvas.style.position = 'relative';
    topologyCanvas.style.overflow = 'hidden';
    
    // Get container dimensions
    const containerRect = topologyCanvas.getBoundingClientRect();
    const width = containerRect.width || 800;
    const height = containerRect.height || 600;
    
    console.log('Canvas dimensions:', width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Network infrastructure positions
    const routerY = 80;
    const firewallY = 160;
    const centralSwitchY = 240;
    
    // Storage for nodes and connections
    const nodes = [];
    const connections = [];
    
    // 1. Router (top of hierarchy)
    const router = createNetworkNode(
        'router', 
        'RTR', 
        centerX, 
        routerY, 
        'Internet Router', 
        'Gateway to external network\nStatus: Connected\nUptime: 99.9%'
    );
    nodes.push(router);
    
    // 2. Firewall
    const firewall = createNetworkNode(
        'firewall', 
        'FW', 
        centerX, 
        firewallY, 
        'Security Firewall', 
        'Network security gateway\nStatus: Active\nThreats blocked: 247'
    );
    nodes.push(firewall);
    
    // 3. Central Switch
    const centralSwitch = createNetworkNode(
        'central-switch', 
        'CS', 
        centerX, 
        centralSwitchY, 
        'Central Switch', 
        'Main distribution switch\nManaging all building connections'
    );
    nodes.push(centralSwitch);
    
    // Create infrastructure connections
    connections.push(createConnection(centerX, routerY + 25, centerX, firewallY - 25, true));
    connections.push(createConnection(centerX, firewallY + 25, centerX, centralSwitchY - 25, true));
    
    // 4. Building Switches
    const validBuildings = buildingGroups.filter(bg => bg.building_name !== 'Unassigned Devices');
    const buildingCount = validBuildings.length;
    
    console.log('Valid buildings:', buildingCount, validBuildings);
    
    if (buildingCount > 0) {
        const radius = Math.min(200, Math.max(120, buildingCount * 15));
        const angleStep = (2 * Math.PI) / buildingCount;
        
        validBuildings.forEach((buildingGroup, index) => {
            const angle = index * angleStep - Math.PI / 2; // Start from top
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            // Determine building status
            const totalDevices = buildingGroup.devices.length;
            const activeDevices = buildingGroup.devices.filter(d => d.device_status == 1).length;
            const maintenanceDevices = buildingGroup.devices.filter(d => d.device_status == 2).length;
            const inactiveDevices = totalDevices - activeDevices - maintenanceDevices;
            
            let buildingStatus = 'active';
            if (totalDevices === 0 || activeDevices === 0) {
                buildingStatus = 'inactive';
            } else if (maintenanceDevices > 0) {
                buildingStatus = 'maintenance';
            }
            
            const buildingSwitch = createNetworkNode(
                `building-switch ${buildingStatus}`, 
                `B${index + 1}`, 
                x, 
                y, 
                buildingGroup.building_name,
                `Building: ${buildingGroup.building_name}\nLocation: ${buildingGroup.building_location || 'Not specified'}\nDevices: ${activeDevices}/${totalDevices} online\nMaintenance: ${maintenanceDevices}\nOffline: ${inactiveDevices}`
            );
            
            // Store building data for interactions
            buildingSwitch.dataset.buildingData = JSON.stringify(buildingGroup);
            buildingSwitch.dataset.buildingIndex = index + 1;
            
            nodes.push(buildingSwitch);
            
            // Create connection from central switch to building
            const connectionActive = buildingStatus !== 'inactive';
            connections.push(createConnection(centerX, centralSwitchY + 25, x, y, connectionActive));
        });
    } else {
        // Show message when no buildings
        const noBuildings = document.createElement('div');
        noBuildings.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: var(--text-muted);
            font-size: 16px;
        `;
        noBuildings.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 10px;">🏢</div>
            <div>No buildings configured</div>
            <div style="font-size: 12px; margin-top: 5px;">Add buildings in the Management section</div>
        `;
        topologyCanvas.appendChild(noBuildings);
    }
    
    // Add all connections first (behind nodes)
    connections.forEach(conn => topologyCanvas.appendChild(conn));
    
    // Add all nodes with interaction handlers
    nodes.forEach(node => {
        topologyCanvas.appendChild(node);
        
        // Enhanced interaction handlers
        node.addEventListener('mouseenter', (e) => {
            showTooltip(e, node.dataset.tooltip);
            node.style.transform = node.style.transform.replace('translate(-50%, -50%)', 'translate(-50%, -50%) scale(1.1)');
        });
        
        node.addEventListener('mouseleave', (e) => {
            hideTooltip();
            node.style.transform = node.style.transform.replace(' scale(1.1)', '');
        });
        
        node.addEventListener('mousemove', (e) => updateTooltipPosition(e));
        node.addEventListener('click', (e) => handleNodeClick(e, node));
    });
    
    console.log('Topology rendered successfully');
}

function createNetworkNode(className, label, x, y, title, tooltipText) {
    const node = document.createElement('div');
    node.className = `network-node ${className}`;
    node.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        transform: translate(-50%, -50%);
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        cursor: pointer;
        transition: transform 0.2s ease;
        z-index: 10;
    `;
    
    // Set colors based on node type
    if (className.includes('router')) {
        node.style.background = 'linear-gradient(135deg, #ff6b35, #ff8e53)';
        node.style.color = 'white';
        node.style.border = '3px solid #ff4500';
    } else if (className.includes('firewall')) {
        node.style.background = 'linear-gradient(135deg, #ffd700, #ffed4a)';
        node.style.color = '#333';
        node.style.border = '3px solid #f39c12';
    } else if (className.includes('central-switch')) {
        node.style.background = 'linear-gradient(135deg, #3498db, #5dade2)';
        node.style.color = 'white';
        node.style.border = '3px solid #2980b9';
    } else if (className.includes('building-switch')) {
        if (className.includes('active')) {
            node.style.background = 'linear-gradient(135deg, #27ae60, #58d68d)';
            node.style.color = 'white';
            node.style.border = '3px solid #229954';
        } else if (className.includes('maintenance')) {
            node.style.background = 'linear-gradient(135deg, #f39c12, #f8c471)';
            node.style.color = 'white';
            node.style.border = '3px solid #d68910';
        } else {
            node.style.background = 'linear-gradient(135deg, #e74c3c, #ec7063)';
            node.style.color = 'white';
            node.style.border = '3px solid #c0392b';
        }
    }
    
    node.textContent = label;
    node.title = title;
    node.dataset.tooltip = tooltipText;
    
    return node;
}

function createConnection(x1, y1, x2, y2, isActive) {
    const connection = document.createElement('div');
    
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    
    connection.style.cssText = `
        position: absolute;
        width: ${length}px;
        height: 3px;
        left: ${x1}px;
        top: ${y1}px;
        transform-origin: 0 50%;
        transform: rotate(${angle}deg);
        background: ${isActive ? 'linear-gradient(90deg, #27ae60, #58d68d)' : 'linear-gradient(90deg, #e74c3c, #ec7063)'};
        z-index: 1;
        border-radius: 2px;
        transition: all 0.3s ease;
    `;
    
    if (isActive) {
        connection.style.boxShadow = '0 0 10px rgba(39, 174, 96, 0.5)';
    }
    
    return connection;
}

function centerTopologyView() {
    if (!topologyCanvas) {
        console.error('Topology canvas not found for centering');
        return;
    }
    
    console.log('Centering topology view');
    
    // Reset scroll position
    topologyCanvas.scrollTop = 0;
    topologyCanvas.scrollLeft = 0;
    
    // Re-render topology to ensure proper positioning
    if (currentTopologyData) {
        renderTopology(currentTopologyData);
    } else {
        // If no data, fetch fresh
        fetchAndDisplayTopology();
    }
}

function showTooltip(event, text) {
    if (!tooltip || !text) return;
    
    tooltip.innerHTML = text.replace(/\n/g, '<br>');
    tooltip.style.opacity = '1';
    updateTooltipPosition(event);
}

function updateTooltipPosition(event) {
    if (!tooltip) return;
    
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = event.pageX + 10;
    let top = event.pageY - 10;
    
    // Prevent tooltip from going off-screen
    if (left + tooltipRect.width > viewportWidth) {
        left = event.pageX - tooltipRect.width - 10;
    }
    
    if (top < 0) {
        top = event.pageY + 20;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function hideTooltip() {
    if (!tooltip) return;
    tooltip.style.opacity = '0';
}

// Make functions globally accessible for debugging and manual calls
window.topologyAPI = {
    refresh: fetchAndDisplayTopology,
    center: centerTopologyView,
    init: initializeTopology,
    render: renderTopology
};

// Auto-initialize when topology view becomes active
document.addEventListener('DOMContentLoaded', function() {
    // Watch for topology view activation
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const topologyView = document.getElementById('topology-view');
                if (topologyView && topologyView.classList.contains('active-view')) {
                    console.log('Topology view activated, initializing...');
                    setTimeout(initializeTopology, 100);
                }
            }
        });
    });
    
    const topologyView = document.getElementById('topology-view');
    if (topologyView) {
        observer.observe(topologyView, { attributes: true });
    }
});

console.log('Network topology functions loaded successfully');


});