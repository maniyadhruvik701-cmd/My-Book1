// ==========================================================================
// My Book - Digital Ledger Web Application Logic
// 100% English & Zero Dummy Data
// ==========================================================================

const STORAGE_KEY = 'khatabook_parties_db_v2';
const BUSINESS_NAME_KEY = 'khatabook_business_name_v2';

// Application State (Completely empty initially - NO DUMMY DATA)
let customers = [];
let currentFilter = 'all';
let currentGlobalSearch = '';
let currentScreenSearch = '';
let currentSort = 'recent';
let selectedCustomerId = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupLiveDate();
  setupEventListeners();
  initPinLock();
  initBackupAndSync();
  renderDashboard();
});

// Load persistent data
function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      customers = JSON.parse(stored);
      // Ensure it's an array
      if (!Array.isArray(customers)) customers = [];
    } catch (e) {
      customers = [];
    }
  } else {
    // Zero dummy data
    customers = [];
    saveData();
  }

  const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
  document.getElementById('businessNameDisplay').textContent = businessName;
  document.getElementById('reportBusinessTitle').textContent = `${businessName} - Ledger Statement`;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

// Format any date/string into DD-MM-YYYY
function formatDateDMY(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateInput)) return dateInput;
    if (/^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      const parts = dateInput.split('T')[0].split('-');
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Current Date & Formatters
function setupLiveDate() {
  const now = new Date();
  const dateFormatted = `${formatDateDMY(now)}`;
  document.getElementById('headerDateDisplay').textContent = dateFormatted;
  document.getElementById('txnDateInput').value = now.toISOString().split('T')[0];
  document.getElementById('reportDateTime').textContent = `Generated on: ${formatDateDMY(now)} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatCurrency(amount) {
  const val = Math.abs(Number(amount) || 0);
  return '₹ ' + val.toLocaleString('en-IN');
}

function getInitials(name) {
  if (!name) return 'C';
  const clean = name.trim();
  // If starts with number
  if (/^[0-9]/.test(clean)) {
    return clean.charAt(0);
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

// Calculate Customer Balance
// You gave = You'll get (debit / + balance)
// You got = You'll give (credit / - balance)
function calculateCustomerBalance(customer) {
  if (!customer.transactions || customer.transactions.length === 0) {
    return { balance: 0, status: 'settled', amount: 0 };
  }

  let totalGave = 0;
  let totalGot = 0;

  customer.transactions.forEach(t => {
    const val = Number(t.amount) || 0;
    if (t.type === 'give') {
      totalGave += val;
    } else if (t.type === 'receive') {
      totalGot += val;
    }
  });

  const net = totalGave - totalGot;

  if (net > 0) {
    return { balance: net, status: 'receive', amount: net };
  } else if (net < 0) {
    return { balance: net, status: 'pay', amount: Math.abs(net) };
  } else {
    return { balance: 0, status: 'settled', amount: 0 };
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Mobile Sidebar Toggle
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Edit Business Name
  document.getElementById('editBusinessBtn').addEventListener('click', () => {
    const currentName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
    const newName = prompt('Enter your Business or Shop name:', currentName);
    if (newName && newName.trim()) {
      const name = newName.trim();
      localStorage.setItem(BUSINESS_NAME_KEY, name);
      document.getElementById('businessNameDisplay').textContent = name;
      document.getElementById('reportBusinessTitle').textContent = `${name} - Ledger Statement`;
      showToast('Business name updated', 'info');
    }
  });

  // Top Global Search
  const globalSearchInput = document.getElementById('globalSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  globalSearchInput.addEventListener('input', (e) => {
    currentGlobalSearch = e.target.value.toLowerCase().trim();
    clearSearchBtn.style.display = currentGlobalSearch ? 'block' : 'none';
    renderDashboard();
  });

  clearSearchBtn.addEventListener('click', () => {
    globalSearchInput.value = '';
    currentGlobalSearch = '';
    clearSearchBtn.style.display = 'none';
    renderDashboard();
    globalSearchInput.focus();
  });

  // Sort Selection
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderDashboard();
  });

  // Filter Chips
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.getAttribute('data-filter');
      renderDashboard();
    });
  });

  // View Management: Dashboard vs Customers List (Image 2)
  let currentActiveView = 'dashboard';

  function switchView(viewName) {
    currentActiveView = viewName;
    const dashboardView = document.getElementById('dashboardView');
    const customersPageView = document.getElementById('customersPageView');
    const dashboardTopHeader = document.getElementById('dashboardTopHeader');
    const navDashboardBtn = document.getElementById('navDashboardBtn');
    const navCustomersBtn = document.getElementById('navCustomersBtn');

    if (viewName === 'customers') {
      if (dashboardTopHeader) dashboardTopHeader.style.display = 'none';
      if (dashboardView) dashboardView.style.display = 'none';
      if (customersPageView) customersPageView.style.display = 'flex';
      navDashboardBtn.classList.remove('active');
      navCustomersBtn.classList.add('active');
      renderCustomersPageView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (dashboardTopHeader) dashboardTopHeader.style.display = 'flex';
      if (dashboardView) dashboardView.style.display = 'flex';
      if (customersPageView) customersPageView.style.display = 'none';
      navDashboardBtn.classList.add('active');
      navCustomersBtn.classList.remove('active');
      renderDashboard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Handle URL hash if any
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#customers') {
      switchView('customers');
    } else if (window.location.hash === '#dashboard' || !window.location.hash) {
      switchView('dashboard');
    }
  });

  if (window.location.hash === '#customers') {
    switchView('customers');
  }

  // Navigation Links
  document.getElementById('navDashboardBtn').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = 'dashboard';
    switchView('dashboard');
  });

  document.getElementById('navCustomersBtn').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = 'customers';
    switchView('customers');
  });

  // Customers Page (Image 2) Search and Add Button
  const pageSearchInput = document.getElementById('customersPageSearchInput');
  const clearPageSearchBtn = document.getElementById('clearPageSearchBtn');
  const pageAddCustomerBtn = document.getElementById('pageAddCustomerBtn');
  const pageEmptyAddBtn = document.getElementById('pageEmptyAddBtn');

  if (pageSearchInput) {
    pageSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      clearPageSearchBtn.style.display = q ? 'block' : 'none';
      renderCustomersPageView();
    });
  }

  if (clearPageSearchBtn) {
    clearPageSearchBtn.addEventListener('click', () => {
      pageSearchInput.value = '';
      clearPageSearchBtn.style.display = 'none';
      renderCustomersPageView();
      pageSearchInput.focus();
    });
  }

  if (pageAddCustomerBtn) {
    pageAddCustomerBtn.addEventListener('click', () => {
      openAddPartyScreen();
    });
  }

  if (pageEmptyAddBtn) {
    pageEmptyAddBtn.addEventListener('click', () => {
      openAddPartyScreen();
    });
  }

  // =========================================================================
  // SCREEN 1: Customer Search / Select Screen (Screenshot 1)
  // =========================================================================
  const openSearchBtn = document.getElementById('openAddCustomerFlowBtn');
  const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
  const searchScreen = document.getElementById('customerSearchScreen');
  const closeSearchScreenBtn = document.getElementById('closeSearchScreenBtn');
  const screenSearchInput = document.getElementById('screenSearchInput');
  const screenSearchClear = document.getElementById('screenSearchClear');

  function openCustomerSearchScreen() {
    screenSearchInput.value = '';
    currentScreenSearch = '';
    screenSearchClear.style.display = 'none';
    renderScreenCustomerList();
    searchScreen.classList.add('active');
    setTimeout(() => screenSearchInput.focus(), 150);
  }

  function closeCustomerSearchScreen() {
    searchScreen.classList.remove('active');
  }

  openSearchBtn.addEventListener('click', openAddPartyScreen);
  emptyStateAddBtn.addEventListener('click', openAddPartyScreen);
  closeSearchScreenBtn.addEventListener('click', closeCustomerSearchScreen);

  screenSearchInput.addEventListener('input', (e) => {
    currentScreenSearch = e.target.value.toLowerCase().trim();
    screenSearchClear.style.display = currentScreenSearch ? 'flex' : 'none';
    renderScreenCustomerList();
  });

  screenSearchClear.addEventListener('click', () => {
    screenSearchInput.value = '';
    currentScreenSearch = '';
    screenSearchClear.style.display = 'none';
    renderScreenCustomerList();
    screenSearchInput.focus();
  });

  // Alphabet Scrubber click
  const scrubber = document.getElementById('alphabetScrubber');
  scrubber.addEventListener('click', (e) => {
    if (e.target.tagName === 'SPAN') {
      const letter = e.target.textContent.trim().toUpperCase();
      screenSearchInput.value = letter;
      currentScreenSearch = letter.toLowerCase();
      screenSearchClear.style.display = 'flex';
      renderScreenCustomerList();
    }
  });

  // =========================================================================
  // SCREEN 2: Add Party Form (Screenshot 2)
  // =========================================================================
  const addPartyScreen = document.getElementById('addPartyScreen');
  const triggerAddPartyBtn = document.getElementById('triggerAddPartyFormBtn');
  const backToAddSearchBtn = document.getElementById('backToAddSearchBtn');
  const addPartyForm = document.getElementById('addPartyForm');
  const toggleGstAddressBtn = document.getElementById('toggleGstAddressBtn');
  const gstAddressSection = document.getElementById('gstAddressSection');
  const accordionToggleIcon = document.getElementById('accordionToggleIcon');

  function openAddPartyScreen() {
    addPartyForm.reset();
    document.querySelector('input[name="partyType"][value="Customer"]').checked = true;
    gstAddressSection.style.display = 'none';
    accordionToggleIcon.textContent = '+';
    addPartyScreen.classList.add('active');
    setTimeout(() => document.getElementById('partyNameInput').focus(), 150);
  }

  function closeAddPartyScreen() {
    addPartyScreen.classList.remove('active');
  }

  triggerAddPartyBtn.addEventListener('click', () => {
    // If user already typed something in search, prefill customer name
    const prefill = screenSearchInput.value.trim();
    openAddPartyScreen();
    if (prefill) {
      document.getElementById('partyNameInput').value = prefill;
    }
  });

  backToAddSearchBtn.addEventListener('click', closeAddPartyScreen);

  // Toggle GSTIN & Address Accordion
  toggleGstAddressBtn.addEventListener('click', () => {
    const isHidden = gstAddressSection.style.display === 'none';
    gstAddressSection.style.display = isHidden ? 'flex' : 'none';
    accordionToggleIcon.textContent = isHidden ? '−' : '+';
  });

  // Submit Add Customer Form
  addPartyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('partyNameInput').value.trim();
    const phone = document.getElementById('partyPhoneInput').value.trim();
    const partyType = document.querySelector('input[name="partyType"]:checked').value;

    // Optional fields
    const gstin = document.getElementById('partyGstinInput').value.trim();
    const building = document.getElementById('partyBuildingInput').value.trim();
    const area = document.getElementById('partyAreaInput').value.trim();
    const pincode = document.getElementById('partyPincodeInput').value.trim();

    if (!name) {
      showToast('Please enter customer name', 'danger');
      return;
    }

    if (phone.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'danger');
      return;
    }

    const newCustomerId = 'cust_' + Date.now();
    const addressParts = [building, area, pincode].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    const newCustomer = {
      id: newCustomerId,
      name: name,
      phone: phone,
      partyType: partyType,
      gstin: gstin,
      address: fullAddress,
      createdAt: new Date().toISOString(),
      transactions: []
    };

    customers.unshift(newCustomer);
    saveData();
    renderDashboard();

    closeAddPartyScreen();
    closeCustomerSearchScreen();
    showToast(`Added ${partyType} "${name}" successfully!`, 'success');

    // Open detail modal for the new customer immediately
    openCustomerDetail(newCustomerId);
  });

  // =========================================================================
  // CUSTOMER DETAIL & TRANSACTION ACTIONS
  // =========================================================================
  const detailModal = document.getElementById('customerDetailModal');
  const closeDetailBtn = document.getElementById('closeDetailModalBtn');
  closeDetailBtn.addEventListener('click', () => detailModal.classList.remove('active'));

  // Delete Customer
  document.getElementById('deleteCustomerBtn').addEventListener('click', () => {
    if (!selectedCustomerId) return;
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;

    if (confirm(`Are you sure you want to delete ${cust.name} and all associated ledger entries?`)) {
      customers = customers.filter(c => c.id !== selectedCustomerId);
      saveData();
      renderDashboard();
      detailModal.classList.remove('active');
      showToast('Customer deleted', 'info');
    }
  });

  // WhatsApp Reminder
  document.getElementById('quickWhatsAppBtn').addEventListener('click', () => {
    if (!selectedCustomerId) return;
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;

    const balInfo = calculateCustomerBalance(cust);
    const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';

    let message = '';
    if (balInfo.status === 'receive') {
      message = `Dear ${cust.name},\n\nThis is a friendly reminder that an outstanding payment of *₹${balInfo.amount.toLocaleString('en-IN')}* is pending at *${businessName}*.\nKindly settle the dues at your earliest convenience.\n\nThank you!`;
    } else if (balInfo.status === 'pay') {
      message = `Dear ${cust.name},\n\nYou have an advance/credit balance of *₹${balInfo.amount.toLocaleString('en-IN')}* at *${businessName}*.\n\nThank you!`;
    } else {
      message = `Dear ${cust.name},\n\nYour account balance with *${businessName}* is fully settled (₹0).\nThank you for your business!`;
    }

    const cleanPhone = cust.phone.replace(/\D/g, '');
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  });

  // You Gave / You Got Buttons
  document.getElementById('btnCustomerGave').addEventListener('click', () => {
    openTransactionModal('give');
  });

  document.getElementById('btnCustomerGot').addEventListener('click', () => {
    openTransactionModal('receive');
  });

  // Transaction Modal Controls
  const txnModal = document.getElementById('transactionModal');
  const closeTxnModalBtn = document.getElementById('closeTxnModalBtn');
  closeTxnModalBtn.addEventListener('click', () => txnModal.classList.remove('active'));

  document.getElementById('recordTxnForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedCustomerId) return;

    const amount = Number(document.getElementById('txnAmountInput').value);
    const note = document.getElementById('txnNoteInput').value.trim() || 'Payment';
    const date = document.getElementById('txnDateInput').value;
    const dir = document.getElementById('txnDirectionInput').value;

    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'danger');
      return;
    }

    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;

    cust.transactions.unshift({
      id: 'txn_' + Date.now(),
      type: dir,
      amount: amount,
      note: note,
      date: date || new Date().toISOString().split('T')[0]
    });

    saveData();
    renderDashboard();
    updateCustomerDetailView(cust);
    txnModal.classList.remove('active');
    showToast(dir === 'give' ? `Recorded ₹${amount} given` : `Recorded ₹${amount} received`, 'success');
  });

  // Report Modal Controls
  const reportModal = document.getElementById('reportModal');
  const openReport = () => {
    populateReportPartySelect();
    renderLedgerReport();
    reportModal.classList.add('active');
  };
  const closeReport = () => reportModal.classList.remove('active');

  document.getElementById('downloadReportBtn').addEventListener('click', openReport);
  document.getElementById('navReportBtn').addEventListener('click', (e) => {
    e.preventDefault();
    openReport();
  });
  document.getElementById('closeReportBtn').addEventListener('click', closeReport);
  document.getElementById('closeReportFooterBtn').addEventListener('click', closeReport);

  // Report Customer Filter Change
  const reportPartySelect = document.getElementById('reportPartySelect');
  if (reportPartySelect) {
    reportPartySelect.addEventListener('change', () => {
      renderLedgerReport();
    });
  }

  // Report View Switcher (Ledger Entries vs Party Balances)
  const btnReportViewTxns = document.getElementById('btnReportViewTxns');
  const btnReportViewSummary = document.getElementById('btnReportViewSummary');
  const reportTxnTableWrap = document.getElementById('reportTxnTableWrap');
  const reportSummaryTableWrap = document.getElementById('reportSummaryTableWrap');

  if (btnReportViewTxns && btnReportViewSummary) {
    btnReportViewTxns.addEventListener('click', () => {
      btnReportViewTxns.classList.add('active');
      btnReportViewSummary.classList.remove('active');
      if (reportTxnTableWrap) reportTxnTableWrap.style.display = 'block';
      if (reportSummaryTableWrap) reportSummaryTableWrap.style.display = 'none';
      renderLedgerReport();
    });

    btnReportViewSummary.addEventListener('click', () => {
      btnReportViewSummary.classList.add('active');
      btnReportViewTxns.classList.remove('active');
      if (reportTxnTableWrap) reportTxnTableWrap.style.display = 'none';
      if (reportSummaryTableWrap) reportSummaryTableWrap.style.display = 'block';
      renderLedgerReport();
    });
  }

  // Print Overall Ledger Report Button
  const printLedgerReportBtn = document.getElementById('printLedgerReportBtn');
  if (printLedgerReportBtn) {
    printLedgerReportBtn.addEventListener('click', () => {
      window.printGeneralReport();
    });
  }

  // Fullscreen Toggles for Modals
  const toggleFsDetailBtn = document.getElementById('toggleFsDetailBtn');
  const fsIconDetail = document.getElementById('fsIconDetail');
  const customerDetailWindow = document.querySelector('#customerDetailModal .mobile-window');

  if (toggleFsDetailBtn && customerDetailWindow) {
    toggleFsDetailBtn.addEventListener('click', () => {
      customerDetailWindow.classList.toggle('is-fullscreen');
      const isFs = customerDetailWindow.classList.contains('is-fullscreen');
      fsIconDetail.className = isFs ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line';
    });
  }

  const toggleFsReportBtn = document.getElementById('toggleFsReportBtn');
  const fsIconReport = document.getElementById('fsIconReport');
  const reportWindow = document.querySelector('#reportModal .mobile-window');

  if (toggleFsReportBtn && reportWindow) {
    toggleFsReportBtn.addEventListener('click', () => {
      reportWindow.classList.toggle('is-fullscreen');
      const isFs = reportWindow.classList.contains('is-fullscreen');
      fsIconReport.className = isFs ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line';
    });
  }

  // Print Customer Ledger Statement (Triggered from header icon or prominent action button)
  const triggerCustomerPrint = () => {
    if (!selectedCustomerId) return;
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;

    prepareCustomerPrintableStatement(cust);
    document.body.classList.remove('printing-report');
    document.body.classList.add('printing-customer');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-customer');
    }, 1000);
  };

  const printCustomerLedgerBtn = document.getElementById('printCustomerLedgerBtn');
  if (printCustomerLedgerBtn) {
    printCustomerLedgerBtn.addEventListener('click', triggerCustomerPrint);
  }

  const printCustomerLedgerBtn2 = document.getElementById('printCustomerLedgerBtn2');
  if (printCustomerLedgerBtn2) {
    printCustomerLedgerBtn2.addEventListener('click', triggerCustomerPrint);
  }
}

// ==========================================================================
// PIN LOCK SCREEN LOGIC (PIN: 2704)
// ==========================================================================
const APP_PIN = '2704';
const SESSION_LOCK_KEY = 'mybook_session_unlocked_v1';
let enteredPin = '';

function initPinLock() {
  const pinLockScreen = document.getElementById('pinLockScreen');
  if (!pinLockScreen) return;

  const pinDots = document.querySelectorAll('.pin-dot');
  const pinHiddenInput = document.getElementById('pinHiddenInput');
  const pinErrorMsg = document.getElementById('pinErrorMsg');
  const pinDotsContainer = document.getElementById('pinDotsContainer');
  const keyBtns = document.querySelectorAll('.pin-key-btn[data-key]');
  const pinClearBtn = document.getElementById('pinClearBtn');
  const pinBackspaceBtn = document.getElementById('pinBackspaceBtn');
  const lockAppHeaderBtn = document.getElementById('lockAppHeaderBtn');
  const navLockBtn = document.getElementById('navLockBtn');

  // Check if session is already unlocked
  const isUnlocked = sessionStorage.getItem(SESSION_LOCK_KEY) === 'true';
  if (isUnlocked) {
    pinLockScreen.classList.remove('active', 'unlocking');
  } else {
    pinLockScreen.classList.add('active');
    pinLockScreen.classList.remove('unlocking');
    focusPinInput();
  }

  function focusPinInput() {
    if (pinHiddenInput) {
      setTimeout(() => {
        pinHiddenInput.focus();
      }, 150);
    }
  }

  function updateDots() {
    pinDots.forEach((dot, index) => {
      if (index < enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled', 'success', 'error');
      }
    });
    if (pinErrorMsg) pinErrorMsg.textContent = '';
  }

  function handleDigit(digit) {
    if (enteredPin.length >= 4) return;
    enteredPin += digit;
    updateDots();

    if (enteredPin.length === 4) {
      validatePin();
    }
  }

  function handleBackspace() {
    if (enteredPin.length > 0) {
      enteredPin = enteredPin.slice(0, -1);
      updateDots();
    }
  }

  function handleClear() {
    enteredPin = '';
    updateDots();
  }

  function validatePin() {
    if (enteredPin === APP_PIN) {
      // Success! Correct PIN 2704
      pinDots.forEach(dot => {
        dot.classList.add('success');
      });
      sessionStorage.setItem(SESSION_LOCK_KEY, 'true');
      if (pinErrorMsg) {
        pinErrorMsg.style.color = '#10b981';
        pinErrorMsg.textContent = 'PIN Verified! Unlocking...';
      }

      setTimeout(() => {
        pinLockScreen.classList.add('unlocking');
        setTimeout(() => {
          pinLockScreen.classList.remove('active', 'unlocking');
          enteredPin = '';
          updateDots();
          if (pinErrorMsg) {
            pinErrorMsg.style.color = '';
            pinErrorMsg.textContent = '';
          }
          showToast('Welcome to My Book! Unlocked successfully.', 'success');
        }, 350);
      }, 250);
    } else {
      // Error: Wrong PIN!
      pinDots.forEach(dot => {
        dot.classList.add('error');
      });
      if (pinDotsContainer) pinDotsContainer.classList.add('shake');
      if (pinErrorMsg) {
        pinErrorMsg.style.color = '#f43f5e';
        pinErrorMsg.textContent = 'Incorrect PIN! Please try again.';
      }

      setTimeout(() => {
        if (pinDotsContainer) pinDotsContainer.classList.remove('shake');
        enteredPin = '';
        updateDots();
      }, 700);
    }
  }

  // Keypad clicks
  keyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.getAttribute('data-key');
      if (key) handleDigit(key);
    });
  });

  if (pinClearBtn) {
    pinClearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleClear();
    });
  }

  if (pinBackspaceBtn) {
    pinBackspaceBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleBackspace();
    });
  }

  // Physical keyboard support
  window.addEventListener('keydown', (e) => {
    if (!pinLockScreen.classList.contains('active')) return;
    
    if (e.key >= '0' && e.key <= '9') {
      handleDigit(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Escape' || e.key === 'Delete') {
      handleClear();
    }
  });

  // Lock Application function
  window.lockApp = function() {
    sessionStorage.removeItem(SESSION_LOCK_KEY);
    enteredPin = '';
    updateDots();
    pinLockScreen.classList.remove('unlocking');
    pinLockScreen.classList.add('active');
    focusPinInput();
    showToast('My Book is locked with PIN', 'neutral');
  };

  if (lockAppHeaderBtn) {
    lockAppHeaderBtn.addEventListener('click', window.lockApp);
  }

  if (navLockBtn) {
    navLockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.lockApp();
    });
  }
}

// ==========================================================================
// MULTI-DEVICE DATA SYNC & BACKUP LOGIC
// ==========================================================================
function initBackupAndSync() {
  const backupModal = document.getElementById('backupModal');
  const closeBackupBtn = document.getElementById('closeBackupBtn');
  const navBackupBtn = document.getElementById('navBackupBtn');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importDataTriggerBtn = document.getElementById('importDataTriggerBtn');
  const importFileInput = document.getElementById('importFileInput');

  function openBackupModal() {
    if (backupModal) backupModal.classList.add('active');
  }

  function closeBackupModal() {
    if (backupModal) backupModal.classList.remove('active');
  }

  if (navBackupBtn) {
    navBackupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openBackupModal();
    });
  }

  if (closeBackupBtn) {
    closeBackupBtn.addEventListener('click', closeBackupModal);
  }

  if (backupModal) {
    backupModal.addEventListener('click', (e) => {
      if (e.target === backupModal) closeBackupModal();
    });
  }

  // 1-Click Export / Download Backup file (.json)
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      const now = new Date();
      const dateStr = formatDateDMY(now);
      const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
      
      const backupData = {
        appName: 'My Book',
        version: '2.0',
        exportedAt: now.toISOString(),
        exportedDate: dateStr,
        businessName: businessName,
        customerCount: customers.length,
        customers: customers
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `MyBook_Ledger_Backup_${dateStr}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      showToast(`Backup exported! Saved ${customers.length} customer records.`, 'success');
    });
  }

  // 1-Click Import file trigger
  if (importDataTriggerBtn && importFileInput) {
    importDataTriggerBtn.addEventListener('click', () => {
      importFileInput.value = '';
      importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!parsed || !Array.isArray(parsed.customers)) {
            showToast('Invalid backup file. Missing customers array.', 'danger');
            return;
          }

          const confirmed = confirm(
            `Found ${parsed.customers.length} customer(s) in backup file from ${parsed.exportedDate || 'previous backup'}.\n\nDo you want to restore and sync this data on this device?`
          );

          if (!confirmed) return;

          customers = parsed.customers;
          saveData();

          if (parsed.businessName) {
            localStorage.setItem(BUSINESS_NAME_KEY, parsed.businessName);
            const bNameDisplay = document.getElementById('businessNameDisplay');
            if (bNameDisplay) bNameDisplay.textContent = parsed.businessName;
            const repTitle = document.getElementById('reportBusinessTitle');
            if (repTitle) repTitle.textContent = `${parsed.businessName} - Ledger Statement`;
          }

          renderDashboard();
          if (typeof renderCustomersPageView === 'function') {
            renderCustomersPageView();
          }

          closeBackupModal();
          showToast(`Data restored successfully! Loaded ${customers.length} customers.`, 'success');
        } catch (err) {
          console.error('Import error:', err);
          showToast('Failed to parse backup file. Please select a valid JSON file.', 'danger');
        }
      };
      reader.readAsText(file);
    });
  }
}

// Global print for overall ledger report
window.printGeneralReport = function() {
  prepareGeneralLedgerPrintable();
  document.body.classList.remove('printing-customer');
  document.body.classList.add('printing-report');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-report');
  }, 1000);
};

// Global print for customer card
window.printCustomerFromCard = function(customerId) {
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;
  prepareCustomerPrintableStatement(cust);
  document.body.classList.remove('printing-report');
  document.body.classList.add('printing-customer');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-customer');
  }, 1000);
};

// Prepare Printable Statement for specific customer ledger
function prepareCustomerPrintableStatement(cust) {
  const shopName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
  const balInfo = calculateCustomerBalance(cust);
  const now = new Date();

  document.getElementById('printShopTitle').textContent = shopName;
  document.getElementById('printStmtDate').textContent = `Statement Date: ${formatDateDMY(now)}`;
  document.getElementById('printPartyName').textContent = cust.name;
  document.getElementById('printPartyPhone').textContent = `+91 ${cust.phone}`;
  document.getElementById('printPartyType').textContent = cust.partyType || 'Customer';

  let netText = formatCurrency(balInfo.amount);
  if (balInfo.status === 'receive') {
    netText += ' (You\'ll Get)';
  } else if (balInfo.status === 'pay') {
    netText += ' (You\'ll Give)';
  } else {
    netText += ' (Settled)';
  }
  document.getElementById('printPartyNetBalance').textContent = netText;

  const tbody = document.getElementById('printTxnTableBody');
  if (!cust.transactions || cust.transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#64748b;">No transactions recorded for this customer.</td></tr>`;
    document.getElementById('printTotalGave').textContent = '₹ 0';
    document.getElementById('printTotalGot').textContent = '₹ 0';
    document.getElementById('printFinalNet').textContent = '₹ 0';
    return;
  }

  // Sort chronological for passbook statement
  const sorted = [...cust.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  let totalGave = 0;
  let totalGot = 0;
  let runningBal = 0;

  tbody.innerHTML = sorted.map((t, idx) => {
    const isGave = t.type === 'give';
    const amt = Number(t.amount) || 0;
    if (isGave) {
      totalGave += amt;
      runningBal += amt;
    } else {
      totalGot += amt;
      runningBal -= amt;
    }

    let balDisplay = '';
    if (runningBal > 0) {
      balDisplay = `${formatCurrency(runningBal)} (Dr)`;
    } else if (runningBal < 0) {
      balDisplay = `${formatCurrency(Math.abs(runningBal))} (Cr)`;
    } else {
      balDisplay = '₹ 0';
    }

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateDMY(t.date)}</td>
        <td>${escapeHTML(t.note || (isGave ? 'You Gave' : 'You Got'))}</td>
        <td style="text-align: right; color: #dc2626; font-weight: 600;">${isGave ? formatCurrency(amt) : '-'}</td>
        <td style="text-align: right; color: #059669; font-weight: 600;">${!isGave ? formatCurrency(amt) : '-'}</td>
        <td style="text-align: right; font-weight: 700;">${balDisplay}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('printTotalGave').textContent = formatCurrency(totalGave);
  document.getElementById('printTotalGot').textContent = formatCurrency(totalGot);
  document.getElementById('printFinalNet').textContent = netText;
}

// Open Transaction Record Modal
function openTransactionModal(type) {
  const modal = document.getElementById('transactionModal');
  const title = document.getElementById('txnModalTitle');
  const header = document.getElementById('txnHeaderBlue');
  const submitBtn = document.getElementById('txnSubmitBtn');
  const dirInput = document.getElementById('txnDirectionInput');

  dirInput.value = type;
  document.getElementById('recordTxnForm').reset();
  document.getElementById('txnDateInput').value = new Date().toISOString().split('T')[0];

  if (type === 'give') {
    title.textContent = 'You Gave (Credit / Debit)';
    header.style.backgroundColor = '#dc2626';
    submitBtn.style.backgroundColor = '#dc2626';
    submitBtn.textContent = 'SAVE AS GAVE';
  } else {
    title.textContent = 'You Got (Payment Received)';
    header.style.backgroundColor = '#059669';
    submitBtn.style.backgroundColor = '#059669';
    submitBtn.textContent = 'SAVE AS GOT';
  }

  modal.classList.add('active');
  setTimeout(() => document.getElementById('txnAmountInput').focus(), 150);
}

// Render Dashboard Data & KPI
function renderDashboard() {
  let totalReceive = 0;
  let totalPay = 0;
  let receiveCount = 0;
  let payCount = 0;
  let settledCount = 0;

  customers.forEach(c => {
    const balInfo = calculateCustomerBalance(c);
    if (balInfo.status === 'receive') {
      totalReceive += balInfo.amount;
      receiveCount++;
    } else if (balInfo.status === 'pay') {
      totalPay += balInfo.amount;
      payCount++;
    } else {
      settledCount++;
    }
  });

  const netBalance = totalReceive - totalPay;

  // KPI elements
  document.getElementById('totalReceiveDisplay').textContent = formatCurrency(totalReceive);
  document.getElementById('totalPayDisplay').textContent = formatCurrency(totalPay);

  const netDisplay = document.getElementById('netBalanceDisplay');
  const netSub = document.getElementById('netBalanceSub');
  netDisplay.textContent = formatCurrency(Math.abs(netBalance));

  if (netBalance > 0) {
    netDisplay.style.color = 'var(--receive-green)';
    netSub.innerHTML = '<span style="color:var(--receive-green); font-weight:600;"><i class="ri-arrow-down-line"></i> Net You will receive</span>';
  } else if (netBalance < 0) {
    netDisplay.style.color = 'var(--pay-red)';
    netSub.innerHTML = '<span style="color:var(--pay-red); font-weight:600;"><i class="ri-arrow-up-line"></i> Net You will give</span>';
  } else {
    netDisplay.style.color = 'var(--brand-blue)';
    netSub.textContent = 'All accounts settled (₹0)';
  }

  const custCount = customers.length;
  document.getElementById('totalCustomerCountDisplay').textContent = custCount;
  document.getElementById('navCustomerCount').textContent = custCount;

  // Filter Counters
  document.getElementById('countAll').textContent = custCount;
  document.getElementById('countReceive').textContent = receiveCount;
  document.getElementById('countPay').textContent = payCount;
  const countSettled = document.getElementById('countSettled');
  if (countSettled) countSettled.textContent = settledCount;

  renderCustomerCards();
  renderCustomersPageView();
}

// Render Dashboard Customer Cards
function renderCustomerCards() {
  const container = document.getElementById('customerListContainer');
  const emptyState = document.getElementById('emptyState');

  // Filter
  let filtered = customers.filter(c => {
    const balInfo = calculateCustomerBalance(c);

    if (currentFilter === 'receive' && balInfo.status !== 'receive') return false;
    if (currentFilter === 'pay' && balInfo.status !== 'pay') return false;
    if (currentFilter === 'settled' && balInfo.status !== 'settled') return false;

    if (currentGlobalSearch) {
      const matchName = c.name.toLowerCase().includes(currentGlobalSearch);
      const matchPhone = c.phone.includes(currentGlobalSearch);
      const matchAddress = c.address && c.address.toLowerCase().includes(currentGlobalSearch);
      return matchName || matchPhone || matchAddress;
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    const balA = calculateCustomerBalance(a);
    const balB = calculateCustomerBalance(b);

    if (currentSort === 'amount-high') {
      return balB.amount - balA.amount;
    } else if (currentSort === 'amount-low') {
      return balA.amount - balB.amount;
    } else if (currentSort === 'name-asc') {
      return a.name.localeCompare(b.name);
    } else {
      const dateA = a.transactions.length ? new Date(a.transactions[0].date).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.transactions.length ? new Date(b.transactions[0].date).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    }
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = filtered.map(cust => {
    const balInfo = calculateCustomerBalance(cust);
    const initials = getInitials(cust.name);

    let statusBadgeClass = 'badge-settled';
    let statusText = 'Settled';
    let amountColor = 'var(--text-muted)';

    if (balInfo.status === 'receive') {
      statusBadgeClass = 'badge-receive';
      statusText = 'You\'ll Get';
      amountColor = 'var(--receive-green)';
    } else if (balInfo.status === 'pay') {
      statusBadgeClass = 'badge-pay';
      statusText = 'You\'ll Give';
      amountColor = 'var(--pay-red)';
    }

    const lastTxn = cust.transactions.length > 0 ? cust.transactions[0] : null;
    const lastTxnText = lastTxn ? `${formatDateDMY(lastTxn.date)} • ${lastTxn.note}` : 'No transactions';

    return `
      <div class="customer-card" onclick="openCustomerDetail('${cust.id}')">
        <div class="customer-card-header">
          <div class="cust-circle-avatar">
            ${initials}
          </div>
          <div class="cust-card-info">
            <h4>
              ${escapeHTML(cust.name)}
              <span class="party-badge-chip">${escapeHTML(cust.partyType || 'Customer')}</span>
            </h4>
            <div class="cust-phone-badge">
              <i class="ri-phone-line"></i> +91 ${escapeHTML(cust.phone)}
            </div>
          </div>
        </div>

        <div class="customer-card-body">
          <div>
            <span class="due-label">Net Balance</span>
            <span class="due-time">${escapeHTML(lastTxnText)}</span>
          </div>
          <div class="due-amount-wrap">
            <div class="due-amount" style="color: ${amountColor};">
              ${formatCurrency(balInfo.amount)}
            </div>
            <span class="status-badge ${statusBadgeClass}">${statusText}</span>
          </div>
        </div>

        <div class="customer-card-footer" onclick="event.stopPropagation()">
          <button class="card-btn card-btn-wa" onclick="sendWhatsAppReminder('${cust.id}')">
            <i class="ri-whatsapp-line"></i> Reminder
          </button>
          <button class="card-btn card-btn-print" onclick="printCustomerFromCard('${cust.id}')" title="Print Ledger Statement">
            <i class="ri-printer-line"></i> Print
          </button>
          <button class="card-btn" onclick="openCustomerDetail('${cust.id}')">
            <i class="ri-file-list-3-line"></i> View Ledger
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Render Full Customers Page (Image 2)
function renderCustomersPageView() {
  const container = document.getElementById('customersAlphabetList');
  const emptyState = document.getElementById('pageEmptyState');
  const countSubtitle = document.getElementById('pageCustomerCountSubtitle');
  const searchInput = document.getElementById('customersPageSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (countSubtitle) {
    countSubtitle.textContent = `${customers.length} customer${customers.length === 1 ? '' : 's'}`;
  }

  // Filter
  let filtered = customers.filter(c => {
    if (!query) return true;
    return c.name.toLowerCase().includes(query) || 
           c.phone.includes(query) || 
           (c.address && c.address.toLowerCase().includes(query));
  });

  // Sort alphabetically by name
  filtered.sort((a, b) => a.name.localeCompare(b.name));

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  // Group by first letter of name
  const groups = {};
  filtered.forEach(cust => {
    const firstChar = cust.name.trim().charAt(0).toUpperCase();
    const groupKey = /^[A-Z]/.test(firstChar) ? firstChar : '#';
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(cust);
  });

  // Render grouped sections like Image 2
  let html = '';
  const sortedKeys = Object.keys(groups).sort();

  sortedKeys.forEach(letter => {
    html += `
      <div class="alphabet-group-section">
        <div class="alphabet-group-header">${letter}</div>
        <div class="alphabet-group-items">
    `;

    groups[letter].forEach(cust => {
      const initial = getInitials(cust.name);
      const balInfo = calculateCustomerBalance(cust);
      
      let balBadgeClass = 'badge-settled';
      let balText = 'Settled';
      if (balInfo.status === 'receive') {
        balBadgeClass = 'badge-receive';
        balText = 'You\'ll Get ' + formatCurrency(balInfo.amount);
      } else if (balInfo.status === 'pay') {
        balBadgeClass = 'badge-pay';
        balText = 'You\'ll Give ' + formatCurrency(balInfo.amount);
      }

      html += `
        <div class="customer-table-row" onclick="openCustomerDetail('${cust.id}')">
          <div class="row-left">
            <div class="row-avatar">${initial}</div>
            <div class="row-name">${escapeHTML(cust.name)}</div>
            <div class="row-phone-pill">
              <i class="ri-phone-line"></i> ${escapeHTML(cust.phone)}
            </div>
          </div>
          <div class="row-right">
            <span class="row-balance-badge ${balBadgeClass}">${balText}</span>
            <i class="ri-arrow-right-s-line row-arrow"></i>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Render Customer List in Search Screen (Screenshot 1)
function renderScreenCustomerList() {
  const container = document.getElementById('screenCustomerList');

  let list = customers.filter(c => {
    if (!currentScreenSearch) return true;
    return c.name.toLowerCase().includes(currentScreenSearch) || c.phone.includes(currentScreenSearch);
  });

  list.sort((a, b) => a.name.localeCompare(b.name));

  if (list.length === 0) {
    if (customers.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <i class="ri-user-add-line" style="font-size: 36px; color: var(--brand-blue); display: block; margin-bottom: 8px;"></i>
          <p style="font-size: 14px; font-weight: 600;">No customers added yet</p>
          <span style="font-size: 12px;">Click "Add Customer" above to create your first customer</span>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <p style="font-size: 14px;">No match found for "${escapeHTML(currentScreenSearch)}"</p>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = list.map(c => {
    const initials = getInitials(c.name);
    const balInfo = calculateCustomerBalance(c);

    let balColor = 'var(--text-muted)';
    let balText = '₹ 0';

    if (balInfo.status === 'receive') {
      balColor = 'var(--receive-green)';
      balText = '+ ' + formatCurrency(balInfo.amount);
    } else if (balInfo.status === 'pay') {
      balColor = 'var(--pay-red)';
      balText = '- ' + formatCurrency(balInfo.amount);
    }

    return `
      <div class="screen-cust-item" onclick="selectCustomerFromScreen('${c.id}')">
        <div class="screen-cust-avatar">
          ${initials}
        </div>
        <div class="screen-cust-info">
          <div class="screen-cust-name">${escapeHTML(c.name)}</div>
          <div class="screen-cust-phone">+91 ${escapeHTML(c.phone)}</div>
        </div>
        <div class="screen-cust-balance" style="color: ${balColor};">
          ${balText}
        </div>
      </div>
    `;
  }).join('');
}

// Select Customer from Screen 1
window.selectCustomerFromScreen = function(id) {
  document.getElementById('customerSearchScreen').classList.remove('active');
  openCustomerDetail(id);
};

// Open Customer Detail Modal
window.openCustomerDetail = function(customerId) {
  selectedCustomerId = customerId;
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;

  updateCustomerDetailView(cust);
  document.getElementById('customerDetailModal').classList.add('active');
};

// Update Customer Detail View
function updateCustomerDetailView(cust) {
  const balInfo = calculateCustomerBalance(cust);

  document.getElementById('detailCustomerName').textContent = cust.name;
  document.getElementById('detailCustomerPhone').textContent = `+91 ${cust.phone} • ${cust.partyType || 'Customer'}`;

  const balVal = document.getElementById('detailBalanceAmount');
  const balTag = document.getElementById('detailBalanceTag');

  balVal.textContent = formatCurrency(balInfo.amount);

  if (balInfo.status === 'receive') {
    balVal.style.color = 'var(--receive-green)';
    balTag.className = 'detail-balance-tag badge-receive';
    balTag.textContent = 'YOU\'LL GET';
  } else if (balInfo.status === 'pay') {
    balVal.style.color = 'var(--pay-red)';
    balTag.className = 'detail-balance-tag badge-pay';
    balTag.textContent = 'YOU\'LL GIVE';
  } else {
    balVal.style.color = 'var(--text-muted)';
    balTag.className = 'detail-balance-tag badge-settled';
    balTag.textContent = 'SETTLED (₹0)';
  }

  // Transactions list
  const listContainer = document.getElementById('detailTransactionList');
  const countSpan = document.getElementById('detailTxnCount');
  countSpan.textContent = `${cust.transactions.length} Entries`;

  if (cust.transactions.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
        <i class="ri-file-list-3-line" style="font-size: 32px; display:block; margin-bottom:8px;"></i>
        No entries recorded yet.<br>Click "YOU GAVE ₹" or "YOU GOT ₹" to add an entry.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = cust.transactions.map(t => {
    const isGave = t.type === 'give';
    return `
      <div class="txn-row">
        <div class="txn-row-left">
          <div class="txn-icon ${isGave ? 'icon-gave' : 'icon-got'}">
            <i class="${isGave ? 'ri-arrow-up-line' : 'ri-arrow-down-line'}"></i>
          </div>
          <div>
            <div class="txn-desc-title">${escapeHTML(t.note || (isGave ? 'You Gave' : 'You Got'))}</div>
            <div class="txn-time-stamp"><i class="ri-calendar-line"></i> ${formatDateDMY(t.date)}</div>
          </div>
        </div>

        <div class="txn-row-right">
          <div class="txn-row-amount ${isGave ? 'amt-gave' : 'amt-got'}">
            ${isGave ? '-' : '+'} ${formatCurrency(t.amount)}
          </div>
          <button class="txn-del-btn" onclick="deleteTxn('${cust.id}', '${t.id}')" title="Delete Entry">
            <i class="ri-delete-bin-7-line"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Delete Single Transaction Entry
window.deleteTxn = function(customerId, txnId) {
  if (!confirm('Are you sure you want to delete this transaction entry?')) return;
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;

  cust.transactions = cust.transactions.filter(t => t.id !== txnId);
  saveData();
  renderDashboard();
  updateCustomerDetailView(cust);
  showToast('Entry deleted', 'info');
};

// WhatsApp Reminder Generator
window.sendWhatsAppReminder = function(customerId) {
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;

  const balInfo = calculateCustomerBalance(cust);
  const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';

  let message = '';
  if (balInfo.status === 'receive') {
    message = `Dear ${cust.name},\n\nThis is a friendly reminder that an outstanding payment of *₹${balInfo.amount.toLocaleString('en-IN')}* is pending at *${businessName}*.\nKindly settle the dues at your earliest convenience.\n\nThank you!`;
  } else if (balInfo.status === 'pay') {
    message = `Dear ${cust.name},\n\nYou have an advance/credit balance of *₹${balInfo.amount.toLocaleString('en-IN')}* at *${businessName}*.\n\nThank you!`;
  } else {
    message = `Dear ${cust.name},\n\nYour account with *${businessName}* is fully settled (₹0).\nThank you for your business!`;
  }

  const cleanPhone = cust.phone.replace(/\D/g, '');
  window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

// Populate Customer Filter inside Report Modal
function populateReportPartySelect() {
  const select = document.getElementById('reportPartySelect');
  if (!select) return;
  const currentVal = select.value || 'all';
  select.innerHTML = '<option value="all">All Customers / Parties</option>' +
    customers.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (+91 ${escapeHTML(c.phone)})</option>`).join('');
  if ([...select.options].some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

// Render Complete Digital Ledger Report (Transactions & Balances)
function renderLedgerReport() {
  const partyFilter = document.getElementById('reportPartySelect')?.value || 'all';
  const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
  document.getElementById('reportBusinessTitle').textContent = `${businessName} - Digital Ledger Report`;
  const now = new Date();
  document.getElementById('reportDateTime').textContent = `Generated on: ${formatDateDMY(now)} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  const activeCustomers = partyFilter === 'all' 
    ? customers 
    : customers.filter(c => c.id === partyFilter);

  // Compute KPI totals
  let totalRec = 0;
  let totalPay = 0;

  activeCustomers.forEach(c => {
    const balInfo = calculateCustomerBalance(c);
    if (balInfo.status === 'receive') totalRec += balInfo.amount;
    if (balInfo.status === 'pay') totalPay += balInfo.amount;
  });

  const netBal = totalRec - totalPay;
  document.getElementById('repTotalReceive').textContent = formatCurrency(totalRec);
  document.getElementById('repTotalPay').textContent = formatCurrency(totalPay);
  document.getElementById('repNetBalance').textContent = formatCurrency(Math.abs(netBal));
  document.getElementById('repNetBalance').style.color = netBal >= 0 ? '#059669' : '#dc2626';

  // 1. Gather all transactions
  const allTxns = [];
  activeCustomers.forEach(c => {
    (c.transactions || []).forEach(t => {
      allTxns.push({
        ...t,
        customerId: c.id,
        customerName: c.name,
        customerPhone: c.phone
      });
    });
  });

  allTxns.sort((a, b) => new Date(a.date) - new Date(b.date));
  document.getElementById('repTotalEntries').textContent = allTxns.length;

  // Render Table 1: Detailed Transactions
  const txnTbody = document.getElementById('reportTxnTableBody');
  if (txnTbody) {
    if (allTxns.length === 0) {
      txnTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">No transaction entries found for selected customer(s).</td></tr>`;
    } else {
      let runningBal = 0;
      txnTbody.innerHTML = allTxns.map((t, idx) => {
        const isGave = t.type === 'give';
        const amt = Number(t.amount) || 0;
        if (isGave) {
          runningBal += amt;
        } else {
          runningBal -= amt;
        }

        let balDisplay = '';
        if (runningBal > 0) {
          balDisplay = `${formatCurrency(runningBal)} (Dr)`;
        } else if (runningBal < 0) {
          balDisplay = `${formatCurrency(Math.abs(runningBal))} (Cr)`;
        } else {
          balDisplay = '₹ 0';
        }

        return `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(formatDateDMY(t.date))}</strong></td>
            <td>
              <strong>${escapeHTML(t.customerName)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">+91 ${escapeHTML(t.customerPhone)}</div>
            </td>
            <td>${escapeHTML(t.note || (isGave ? 'You Gave' : 'You Got'))}</td>
            <td style="text-align: right; color: #dc2626; font-weight: 600;">${isGave ? formatCurrency(amt) : '-'}</td>
            <td style="text-align: right; color: #059669; font-weight: 600;">${!isGave ? formatCurrency(amt) : '-'}</td>
            <td style="text-align: right; font-weight: 700;">${balDisplay}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Render Table 2: Customer Summary
  const summaryTbody = document.getElementById('reportTableBody');
  if (summaryTbody) {
    if (activeCustomers.length === 0) {
      summaryTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">No records found</td></tr>`;
    } else {
      summaryTbody.innerHTML = activeCustomers.map((c, i) => {
        const balInfo = calculateCustomerBalance(c);
        let statusText = 'Settled (₹0)';
        let colorStyle = '#475569';
        if (balInfo.status === 'receive') {
          statusText = 'You\'ll Get';
          colorStyle = '#059669';
        } else if (balInfo.status === 'pay') {
          statusText = 'You\'ll Give';
          colorStyle = '#dc2626';
        }

        return `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHTML(c.name)}</strong></td>
            <td>+91 ${escapeHTML(c.phone)}</td>
            <td>${escapeHTML(c.partyType || 'Customer')}</td>
            <td><span style="font-weight:600; color:${colorStyle};">${statusText}</span></td>
            <td style="text-align: right; font-weight:700; color:${colorStyle};">${formatCurrency(balInfo.amount)}</td>
          </tr>
        `;
      }).join('');
    }
  }
}

// Prepare Printable Statement for Overall / Filtered General Ledger
function prepareGeneralLedgerPrintable() {
  const partyFilter = document.getElementById('reportPartySelect')?.value || 'all';
  const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
  const now = new Date();

  document.getElementById('printLedgerBusinessTitle').textContent = businessName;
  document.getElementById('printLedgerGeneratedDate').textContent = `Statement Date: ${formatDateDMY(now)}`;

  const activeCustomers = partyFilter === 'all' 
    ? customers 
    : customers.filter(c => c.id === partyFilter);

  const scopeLabel = partyFilter === 'all'
    ? 'All Customers / Parties'
    : (activeCustomers[0] ? `${activeCustomers[0].name} (+91 ${activeCustomers[0].phone})` : 'Selected Customer');

  document.getElementById('printLedgerFilterScope').textContent = `Scope: ${scopeLabel}`;
  document.getElementById('printLedgerScopeLabel').textContent = scopeLabel;

  const allTxns = [];
  let totalGave = 0;
  let totalGot = 0;

  activeCustomers.forEach(c => {
    (c.transactions || []).forEach(t => {
      allTxns.push({
        ...t,
        customerName: c.name,
        customerPhone: c.phone
      });
    });
  });

  allTxns.sort((a, b) => new Date(a.date) - new Date(b.date));

  const tbody = document.getElementById('printLedgerTableBody');
  if (allTxns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#64748b;">No transactions found for the selected scope.</td></tr>`;
    document.getElementById('printLedgerTotalGave').textContent = '₹ 0';
    document.getElementById('printLedgerTotalGot').textContent = '₹ 0';
    document.getElementById('printLedgerNetBalance').textContent = '₹ 0';
    document.getElementById('printLedgerFooterGave').textContent = '₹ 0';
    document.getElementById('printLedgerFooterGot').textContent = '₹ 0';
    document.getElementById('printLedgerFooterNet').textContent = '₹ 0';
    return;
  }

  let runningBal = 0;
  tbody.innerHTML = allTxns.map((t, idx) => {
    const isGave = t.type === 'give';
    const amt = Number(t.amount) || 0;
    if (isGave) {
      totalGave += amt;
      runningBal += amt;
    } else {
      totalGot += amt;
      runningBal -= amt;
    }

    let balDisplay = '';
    if (runningBal > 0) {
      balDisplay = `${formatCurrency(runningBal)} (Dr)`;
    } else if (runningBal < 0) {
      balDisplay = `${formatCurrency(Math.abs(runningBal))} (Cr)`;
    } else {
      balDisplay = '₹ 0';
    }

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHTML(formatDateDMY(t.date))}</td>
        <td><strong>${escapeHTML(t.customerName)}</strong></td>
        <td>${escapeHTML(t.note || (isGave ? 'You Gave' : 'You Got'))}</td>
        <td style="text-align: right; color: #dc2626; font-weight: 600;">${isGave ? formatCurrency(amt) : '-'}</td>
        <td style="text-align: right; color: #059669; font-weight: 600;">${!isGave ? formatCurrency(amt) : '-'}</td>
        <td style="text-align: right; font-weight: 700;">${balDisplay}</td>
      </tr>
    `;
  }).join('');

  const netBal = totalGave - totalGot;
  let netText = formatCurrency(Math.abs(netBal));
  if (netBal > 0) netText += ' (You\'ll Get)';
  else if (netBal < 0) netText += ' (You\'ll Give)';
  else netText += ' (Settled)';

  document.getElementById('printLedgerTotalGave').textContent = formatCurrency(totalGave);
  document.getElementById('printLedgerTotalGot').textContent = formatCurrency(totalGot);
  document.getElementById('printLedgerNetBalance').textContent = netText;

  document.getElementById('printLedgerFooterGave').textContent = formatCurrency(totalGave);
  document.getElementById('printLedgerFooterGot').textContent = formatCurrency(totalGot);
  document.getElementById('printLedgerFooterNet').textContent = netText;
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'ri-information-line';
  if (type === 'success') icon = 'ri-checkbox-circle-line';
  if (type === 'danger') icon = 'ri-error-warning-line';

  toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Utility: HTML Sanitizer
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
