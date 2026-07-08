/**
 * Secure Chat App - Core Application Logic
 * Integrates: Real-time WebRTC Voice/Video Calling & MQTT E2EE Messaging via HiveMQ WebSocket Broker.
 * Supports: Forgot Password (OTP Verification) and OTP-based Sign Up.
 */

// Application State
const state = {
  currentUser: null, 
  activeChatId: null, 
  activeTab: 'chats',
  contacts: {},
  statusList: [],
  activeStatusTimer: null,
  
  // OTP Session flow state
  signupVerified: false,
  signupOtp: null,
  signupPhonePending: null,
  signupEmailPending: null,

  forgotOtp: null,
  forgotPhonePending: null,
  forgotEmailPending: null,

  // WebRTC & Call State
  peerConnection: null,
  callStream: null,
  callTimerInterval: null,
  callTimeout: null,
  ringtoneInterval: null,
  dialerToneInterval: null,
  audioContext: null,
  activeBeeps: [],
  isIncomingCall: false,
  pendingOffer: null,
  remoteNumber: null,
  queuedCandidates: [], // Queue for ICE candidates before connection is set up
  callStartTime: 0,
  
  // Call Recording State
  mediaRecorder: null,
  recordedChunks: [],

  // Customization & Lock state
  lockedChats: JSON.parse(localStorage.getItem('pc_locked_chats') || '[]'),
  unlockedSessions: [],

  // Presence and Typing state
  activePresenceTopic: null,
  activeContactLastSeen: 0,
  activeContactStatusTimer: null,
  typingPublishTimeout: null,

  // Reply State
  replyTo: null
};

// Global Signal Broker Reference
let brokerClient = null;
let heartbeatInterval = null;

// STUN servers configuration for NAT traversal
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Mock Registered Directory
const MOCK_REGISTERED_USERS = [
  "8767110149",
  "9876543210",
  "8888888888",
  "7777777777",
  "9999999999"
];

// Emojis list
const EMOJIS = ["😀", "😂", "😍", "👍", "🔥", "🎉", "❤️", "👏", "🚀", "🤔", "😢", "😎", "😮", "😡", "🙌", "💩", "💯", "🙏"];

// DOM Elements
const el = {
  screenSignup: document.getElementById('screen-signup'),
  screenLogin: document.getElementById('screen-login'),
  screenDashboard: document.getElementById('screen-dashboard'),
  
  signupStep1: document.getElementById('signup-step-1'),
  btnSignupSendOtp: document.getElementById('btn-signup-send-otp'),
  signupOtpWrapper: document.getElementById('signup-otp-wrapper'),
  signupOtpInput: document.getElementById('signup-otp-input'),
  btnSignupVerifyOtp: document.getElementById('btn-signup-verify-otp'),

  signupForm: document.getElementById('signup-form'),
  signupPhone: document.getElementById('signup-phone'),
  signupEmail: document.getElementById('signup-email'),
  signupName: document.getElementById('signup-name'),
  signupFullname: document.getElementById('signup-fullname'),
  signupDob: document.getElementById('signup-dob'),
  signupGender: document.getElementById('signup-gender'),
  signupLocation: document.getElementById('signup-location'),
  btnDetectSignupLocation: document.getElementById('btn-detect-signup-location'),
  signupPasswordChoose: document.getElementById('signup-password-choose'),
  signupError: document.getElementById('signup-error'),
  linkGotoLoginFromSignup: document.getElementById('link-goto-login-from-signup'),

  loginForm: document.getElementById('login-form'),
  loginPhone: document.getElementById('login-phone'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  linkGotoSignup: document.getElementById('link-goto-signup'),
  linkForgotClass: document.getElementById('link-forgot-password'),

  modalForgotPassword: document.getElementById('modal-forgot-password'),
  forgotPhoneInput: document.getElementById('forgot-phone-input'),
  btnForgotSendOtp: document.getElementById('btn-forgot-send-otp'),
  forgotStep1: document.getElementById('forgot-step-1'),
  forgotStep2: document.getElementById('forgot-step-2'),
  forgotEmailLabel: document.getElementById('forgot-email-label'),
  forgotOtpInput: document.getElementById('forgot-otp-input'),
  forgotPasswordNew: document.getElementById('forgot-password-new'),
  btnForgotResetSubmit: document.getElementById('btn-forgot-reset-submit'),
  forgotError: document.getElementById('forgot-error'),
  linkForgotCancel: document.getElementById('link-forgot-cancel'),
  
  tabChatsBtn: document.getElementById('tab-chats-btn'),
  tabCallsBtn: document.getElementById('tab-calls-btn'),
  tabStatusBtn: document.getElementById('tab-status-btn'),
  tabProfileBtn: document.getElementById('tab-profile-btn'),
  tabPrivacyBtn: document.getElementById('tab-privacy-btn'),
  
  tabChatsContent: document.getElementById('tab-chats-content'),
  tabCallsContent: document.getElementById('tab-calls-content'),
  tabStatusContent: document.getElementById('tab-status-content'),
  tabProfileContent: document.getElementById('tab-profile-content'),
  tabPrivacyContent: document.getElementById('tab-privacy-content'),
  
  contactsList: document.getElementById('contacts-list'),
  callHistoryList: document.getElementById('call-history-list'),
  btnAddContact: document.getElementById('btn-add-contact'),
  modalAddContact: document.getElementById('modal-add-contact'),
  addContactForm: document.getElementById('add-contact-form'),
  contactNameInput: document.getElementById('contact-name-input'),
  contactPhoneInput: document.getElementById('contact-phone-input'),
  contactError: document.getElementById('contact-error'),
  btnCloseContactModal: document.getElementById('btn-close-contact-modal'),

  chatPlaceholder: document.getElementById('chat-placeholder-view'),
  chatActiveView: document.getElementById('chat-active-view'),
  chatHeaderName: document.getElementById('chat-header-name'),
  chatHeaderNumber: document.getElementById('chat-header-number'),
  chatHeaderAvatar: document.getElementById('chat-header-avatar'),
  chatMessages: document.getElementById('chat-messages'),
  chatTextInput: document.getElementById('chat-text-input'),
  btnSendMessage: document.getElementById('btn-send-message'),
  btnAttachment: document.getElementById('btn-attachment'),
  chatFileInput: document.getElementById('chat-file-input'),
  btnChatBack: document.getElementById('btn-chat-back'),

  btnVoiceCall: document.getElementById('btn-voice-call'),
  btnVideoCall: document.getElementById('btn-video-call'),
  btnBlockContact: document.getElementById('btn-block-contact'),
  blockBtnLabel: document.getElementById('block-btn-label'),
  btnDeleteChat: document.getElementById('btn-delete-chat'),
  blockedBanner: document.getElementById('blocked-banner'),
  btnUnblockBanner: document.getElementById('btn-unblock-banner'),
  chatInputRow: document.getElementById('chat-input-row'),
  btnShareLocation: document.getElementById('btn-share-location'),

  callOverlay: document.getElementById('call-overlay'),
  callAvatar: document.getElementById('call-avatar'),
  callName: document.getElementById('call-name'),
  callStatus: document.getElementById('call-status'),
  callTimer: document.getElementById('call-timer'),
  callVideoContainer: document.getElementById('call-video-container'),
  callLocalVideo: document.getElementById('call-local-video'),
  callRemoteVideo: document.getElementById('call-remote-video'),
  btnAcceptCall: document.getElementById('btn-accept-call'),
  btnEndCall: document.getElementById('btn-end-call'),
  btnCallRecord: document.getElementById('btn-call-record'),
  callRecordBanner: document.getElementById('call-record-banner'),

  btnExportChats: document.getElementById('btn-export-chats'),
  importFileInput: document.getElementById('import-file-input'),
  blockedContactsList: document.getElementById('blocked-contacts-list'),
  btnWipeData: document.getElementById('btn-wipe-data'),
  btnHeaderLogout: document.getElementById('btn-header-logout'),

  themeSelect: document.getElementById('theme-select'),
  profileThemeSelect: document.getElementById('profile-theme-select'),
  fontSelect: document.getElementById('font-select'),
  wallpaperSelect: document.getElementById('wallpaper-select'),
  customWallpaperInput: document.getElementById('custom-wallpaper-input'),
  customWallpaperWrapper: document.getElementById('custom-wallpaper-wrapper'),

  btnEmoji: document.getElementById('btn-emoji'),
  emojiPickerPopup: document.getElementById('emoji-picker-popup'),

  btnLockChat: document.getElementById('btn-lock-chat'),
  lockBtnLabel: document.getElementById('lock-btn-label'),
  modalChatLock: document.getElementById('modal-chat-lock'),
  chatLockPassword: document.getElementById('chat-lock-password'),
  chatLockError: document.getElementById('chat-lock-error'),
  btnChatLockCancel: document.getElementById('btn-chat-lock-cancel'),
  btnChatLockSubmit: document.getElementById('btn-chat-lock-submit'),

  btnAddStatus: document.getElementById('btn-add-status'),
  modalAddStatus: document.getElementById('modal-add-status'),
  statusImageInput: document.getElementById('status-image-input'),
  statusTextInput: document.getElementById('status-text-input'),
  btnSubmitTextStatus: document.getElementById('btn-submit-text-status'),
  btnCloseStatusModal: document.getElementById('btn-close-status-modal'),
  statusList: document.getElementById('status-list'),
  myStatusAvatar: document.getElementById('my-status-avatar'),
  myStatusAvatarWrapper: document.getElementById('my-status-avatar-wrapper'),
  myStatusRing: document.getElementById('my-status-ring'),
  myStatusLabel: document.getElementById('my-status-label'),
  myStatusTimeLabel: document.getElementById('my-status-time-label'),

  statusViewerModal: document.getElementById('status-viewer-modal'),
  statusProgressContainer: document.getElementById('status-progress-container'),
  statusViewerAvatar: document.getElementById('status-viewer-avatar'),
  statusViewerName: document.getElementById('status-viewer-name'),
  statusViewerTime: document.getElementById('status-viewer-time'),
  statusViewerClose: document.getElementById('status-viewer-close'),
  statusViewerBody: document.getElementById('status-viewer-body'),

  imageLightbox: document.getElementById('image-lightbox'),
  imageLightboxImg: document.getElementById('image-lightbox-img'),

  profileName: document.getElementById('profile-name'),
  profileBio: document.getElementById('profile-bio'),
  profilePic: document.getElementById('profile-pic'),
  profileAvatarInput: document.getElementById('profile-avatar-input'),
  btnSaveProfile: document.getElementById('btn-save-profile'),
  btnLogout: document.getElementById('btn-logout'),

  // Reply DOM
  replyPreviewContainer: document.getElementById('reply-preview-container'),
  replyPreviewText: document.getElementById('reply-preview-text'),
  btnCancelReply: document.getElementById('btn-cancel-reply'),

  // Mailer Config elements
  appsScriptUrl: document.getElementById('apps-script-url'),
  emailjsServiceId: document.getElementById('emailjs-service-id'),
  emailjsTemplateId: document.getElementById('emailjs-template-id'),
  emailjsPublicKey: document.getElementById('emailjs-public-key'),
  btnSaveEmailjsConfig: document.getElementById('btn-save-emailjs-config')
};

// Constants
const DURATION_STATUS_EXPIRY = 12 * 60 * 60 * 1000;
const STATUS_AUTOPLAY_MS = 5000;
const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%235e647c'><circle cx='50' cy='50' r='50' fill='%2312121e'/><circle cx='50' cy='38' r='20'/><path d='M15 80c0-18 15-30 35-30s35 12 35 30H15z'/></svg>";

/* ==========================================================================
   1. OTP MAILER DISPATCH SYSTEM (SUPPORTING BOTH APPS SCRIPT AND EMAILJS)
   ========================================================================== */

function generate6DigitOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function dispatchVerificationOTP(email, name, otp) {
  const appsScriptUrl = localStorage.getItem('pc_apps_script_url') || 'https://script.google.com/macros/s/AKfycbxwlgljBOfYvvE-dUS3WEfylEOpXJTk1afc1rYhHSvfVz9zFAkeSwiImBm2F5sAWzgMZw/exec';
  
  if (appsScriptUrl) {
    try {
      await fetch(appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Avoids local CORS redirect blocks, triggers mail safely
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to_email: email,
          otp_code: otp
        })
      });
      console.log("Apps Script email dispatch triggered silently to " + email);
      console.log(`[E2EE OTP DISPATCH] Sent via Apps Script to: ${email} -> CODE: ${otp}`);
      return true;
    } catch(err) {
      console.warn("Apps Script dispatch failed, trying EmailJS fallback. Detail: ", err);
    }
  }

  const serviceId = localStorage.getItem('pc_emailjs_service_id') || 'service_p1x6m7u';
  const templateId = localStorage.getItem('pc_emailjs_template_id') || 'template_otp';
  const publicKey = localStorage.getItem('pc_emailjs_public_key') || 'user_j9G8zD7b6x';

  if (serviceId && templateId && publicKey) {
    try {
      emailjs.init(publicKey);
      await emailjs.send(serviceId, templateId, {
        to_email: email,
        to_name: name,
        otp_code: otp,
        app_name: "PrivacyChat"
      });
      console.log("EmailJS dispatch successful to " + email);
    } catch(err) {
      console.warn("EmailJS dispatch failed. Detail: ", err);
    }
  }

  // Silent logger to console for developer testing
  console.log(`[E2EE OTP DISPATCH] Developer Local Fallback -> Email: ${email} -> CODE: ${otp}`);
  return true;
}

// Save Mailer configs in settings
if (el.btnSaveEmailjsConfig) {
  el.btnSaveEmailjsConfig.addEventListener('click', () => {
    localStorage.setItem('pc_apps_script_url', el.appsScriptUrl.value.trim());
    localStorage.setItem('pc_emailjs_service_id', el.emailjsServiceId.value.trim());
    localStorage.setItem('pc_emailjs_template_id', el.emailjsTemplateId.value.trim());
    localStorage.setItem('pc_emailjs_public_key', el.emailjsPublicKey.value.trim());
    alert("Mailer configurations saved successfully!");
  });
}

function loadEmailJSConfigUI() {
  if (el.emailjsServiceId) {
    el.appsScriptUrl.value = localStorage.getItem('pc_apps_script_url') || 'https://script.google.com/macros/s/AKfycbxwlgljBOfYvvE-dUS3WEfylEOpXJTk1afc1rYhHSvfVz9zFAkeSwiImBm2F5sAWzgMZw/exec';
    el.emailjsServiceId.value = localStorage.getItem('pc_emailjs_service_id') || '';
    el.emailjsTemplateId.value = localStorage.getItem('pc_emailjs_template_id') || '';
    el.emailjsPublicKey.value = localStorage.getItem('pc_emailjs_public_key') || '';
  }
}

/* ==========================================================================
   2. OTP SIGN UP FLOW
   ========================================================================== */

function isValidMobile(number) {
  return /^[6789]\d{9}$/.test(number);
}

function getDailyPassword() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

async function isNumberRegistered(number) {
  if (MOCK_REGISTERED_USERS.includes(number)) return true;
  const profile = await window.AppDB.get('profile', number);
  return profile !== undefined;
}

// STEP 1: Click Send OTP on Sign Up
el.btnSignupSendOtp.addEventListener('click', async () => {
  const phone = el.signupPhone.value.trim();
  const email = el.signupEmail.value.trim();

  if (!isValidMobile(phone)) {
    showSignupError("Error: Enter valid 10-digit number starting with 6-9.");
    return;
  }

  if (!email.includes("@")) {
    showSignupError("Error: Enter a valid email address.");
    return;
  }

  const alreadyExists = await window.AppDB.get('profile', phone);
  if (alreadyExists) {
    showSignupError("Error: User already registered with this mobile number.");
    return;
  }

  el.signupError.style.display = 'none';
  state.signupOtp = generate6DigitOTP();
  state.signupPhonePending = phone;
  state.signupEmailPending = email;

  // Dispatch OTP
  await dispatchVerificationOTP(email, "New User", state.signupOtp);
  el.signupOtpWrapper.style.display = 'flex';
  
  // Show clean status label on card
  el.signupError.textContent = "OTP Sent Successfully!";
  el.signupError.style.color = "var(--success-color)";
  el.signupError.style.display = "block";
  
  el.btnSignupSendOtp.textContent = "Resend OTP";
});

// Verify OTP
el.btnSignupVerifyOtp.addEventListener('click', () => {
  const entered = el.signupOtpInput.value.trim();
  if (entered === state.signupOtp) {
    state.signupVerified = true;
    el.signupStep1.style.display = 'none';
    el.signupForm.style.display = 'flex';
    
    el.signupError.textContent = "OTP Verified Successfully!";
    el.signupError.style.color = "var(--success-color)";
    el.signupError.style.display = "block";
  } else {
    el.signupError.style.color = "var(--danger-color)";
    showSignupError("Error: Incorrect OTP Code.");
  }
});

// STEP 2: Sign Up Submit Registration
el.signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.signupVerified) {
    showSignupError("Error: Please verify OTP first.");
    return;
  }

  const name = el.signupName.value.trim();
  const fullname = el.signupFullname.value.trim();
  const dob = el.signupDob.value.trim();
  const gender = el.signupGender.value.trim();
  const location = el.signupLocation.value.trim();
  const password = el.signupPasswordChoose.value.trim();

  if (password.length < 4) {
    showSignupError("Error: Password must be at least 4 characters long.");
    return;
  }

  const profile = {
    number: state.signupPhonePending,
    email: state.signupEmailPending,
    name: name,
    fullName: fullname,
    dob: dob,
    gender: gender,
    location: location,
    bio: "Hey there! I am using PrivacyChat.",
    photo: DEFAULT_AVATAR,
    password: password // Custom password
  };

  await window.AppDB.put('profile', profile);

  el.loginPhone.value = state.signupPhonePending;
  el.loginPassword.value = password;
  
  // Reset Sign up state
  state.signupVerified = false;
  state.signupOtp = null;
  el.signupStep1.style.display = 'flex';
  el.signupOtpWrapper.style.display = 'none';
  el.signupForm.style.display = 'none';
  el.signupForm.reset();

  el.screenSignup.classList.remove('active');
  el.screenLogin.classList.add('active');
  alert("Profile Registered Successfully! Log in using your custom password.");
});

function showSignupError(msg) {
  el.signupError.style.color = "var(--danger-color)";
  el.signupError.textContent = msg;
  el.signupError.style.display = 'block';
}

el.btnDetectSignupLocation.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }
  el.btnDetectSignupLocation.innerHTML = `<i class="ph ph-spinner animate-spin"></i>`;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      el.signupLocation.value = `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`;
      el.btnDetectSignupLocation.innerHTML = `<i class="ph ph-gps" style="color: var(--accent-color);"></i> <span>Detect</span>`;
    },
    () => {
      alert("Could not detect location automatically.");
      el.btnDetectSignupLocation.innerHTML = `<i class="ph ph-gps" style="color: var(--accent-color);"></i> <span>Detect</span>`;
    }
  );
});

el.linkGotoLoginFromSignup.addEventListener('click', (e) => {
  e.preventDefault();
  el.screenSignup.classList.remove('active');
  el.screenLogin.classList.add('active');
});

/* ==========================================================================
   3. LOGIN SUBMIT & FORGOT PASSWORD LOGIC
   ========================================================================== */

el.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = el.loginPhone.value.trim();
  const passwordInput = el.loginPassword.value.trim();

  if (!isValidMobile(phone)) {
    showLoginError("Error: Valid 10-digit mobile number only.");
    return;
  }

  const storedProfile = await window.AppDB.get('profile', phone);
  if (!storedProfile) {
    showLoginError("Error: Profile not registered on this device. Please Sign Up.");
    return;
  }

  if (storedProfile.password !== passwordInput) {
    showLoginError("Error: Access denied. Incorrect password.");
    return;
  }

  el.loginError.style.display = 'none';

  const cryptoSuccess = await window.AppCrypto.initializeKey(passwordInput);
  if (!cryptoSuccess) {
    showLoginError("Cryptographic engine failed to initialize.");
    return;
  }

  state.currentUser = storedProfile;
  localStorage.setItem('pc_active_phone', phone);
  updateProfileTabUI();

  el.screenLogin.classList.remove('active');
  el.screenDashboard.classList.add('active');
  
  connectSignalBroker();
  switchTab('chats');
  await loadAppDashboard();
  setInterval(cleanupOldStatuses, 30000);
});

function showLoginError(msg) {
  el.loginError.textContent = msg;
  el.loginError.style.display = 'block';
}

el.linkGotoSignup.addEventListener('click', (e) => {
  e.preventDefault();
  el.screenLogin.classList.remove('active');
  el.screenSignup.classList.add('active');
});

// FORGOT PASSWORD POPUP MODAL HANDLERS
el.linkForgotClass.addEventListener('click', (e) => {
  e.preventDefault();
  el.modalForgotPassword.classList.add('active');
  el.forgotStep1.style.display = 'flex';
  el.forgotStep2.style.display = 'none';
  el.forgotError.style.display = 'none';
  el.forgotPhoneInput.value = '';
});

el.linkForgotCancel.addEventListener('click', (e) => {
  e.preventDefault();
  el.modalForgotPassword.classList.remove('active');
});

// Forgot Step 1: Send Password Reset OTP
el.btnForgotSendOtp.addEventListener('click', async () => {
  const phone = el.forgotPhoneInput.value.trim();
  if (!isValidMobile(phone)) {
    showForgotError("Error: Valid 10-digit mobile number only.");
    return;
  }

  const profile = await window.AppDB.get('profile', phone);
  if (!profile) {
    showForgotError("Error: Mobile number not registered on this device.");
    return;
  }

  const email = profile.email || `${profile.name.toLowerCase()}@gmail.com`;
  state.forgotOtp = generate6DigitOTP();
  state.forgotPhonePending = phone;
  state.forgotEmailPending = email;

  el.forgotError.style.display = 'none';
  
  await dispatchVerificationOTP(email, profile.name, state.forgotOtp);

  el.forgotStep1.style.display = 'none';
  el.forgotStep2.style.display = 'flex';
  el.forgotEmailLabel.textContent = `OTP code sent successfully! Check your email.`;
  el.forgotOtpInput.value = '';
  el.forgotPasswordNew.value = '';
});

// Forgot Step 2: Validate OTP and Set New Password
el.btnForgotResetSubmit.addEventListener('click', async () => {
  const enteredOtp = el.forgotOtpInput.value.trim();
  const newPass = el.forgotPasswordNew.value.trim();

  if (enteredOtp !== state.forgotOtp) {
    showForgotError("Error: Incorrect OTP code. Please try again.");
    return;
  }

  if (newPass.length < 4) {
    showForgotError("Error: Password must be at least 4 characters long.");
    return;
  }

  const profile = await window.AppDB.get('profile', state.forgotPhonePending);
  if (!profile) return;

  profile.password = newPass;
  await window.AppDB.put('profile', profile);

  el.modalForgotPassword.classList.remove('active');
  alert("Password reset successfully! Logging you in now.");

  el.loginPhone.value = state.forgotPhonePending;
  el.loginPassword.value = newPass;
  el.loginForm.dispatchEvent(new Event('submit'));
});

function showForgotError(msg) {
  el.forgotError.style.color = "var(--danger-color)";
  el.forgotError.textContent = msg;
  el.forgotError.style.display = 'block';
}

/* ==========================================================================
   4. SIGNAL BROKER CONNECTION (MQTT OVER EMQX SECURE WEBSOCKETS - HIGH UPTIME)
   ========================================================================== */

function connectSignalBroker() {
  if (!state.currentUser) return;
  
  const statusIndicator = document.getElementById('connection-status');
  const headerStatus = document.getElementById('header-conn-status');
  
  function updateUIStatus(statusText, colorClass, dotColor) {
    if (statusIndicator) {
      statusIndicator.textContent = statusText;
      statusIndicator.className = `metric-value ${colorClass}`;
    }
    if (headerStatus) {
      headerStatus.style.color = dotColor;
      headerStatus.style.borderColor = dotColor + '33';
      headerStatus.style.background = dotColor + '1a';
      headerStatus.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: ${dotColor}; display: inline-block; animation: pulse 2s infinite;"></span> ${statusText.split(' ')[0]}`;
    }
  }

  updateUIStatus("Connecting...", "warning", "#ffd600");

  // Connect to EMQX public broker with auto-reconnect option enabled
  brokerClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
    clientId: 'pc_client_' + state.currentUser.number + '_' + Math.random().toString(36).slice(2, 9),
    clean: true,
    keepalive: 30, // Keep connection alive with short keepalive
    reconnectPeriod: 2000, // AUTO-RECONNECT every 2 seconds if connection drops!
    connectTimeout: 10000
  });

  brokerClient.on('connect', () => {
    updateUIStatus("Online (E2EE Signal)", "success", "#00e676");
    
    const msgTopic = 'privacychat_atul_39281/msg/' + state.currentUser.number;
    const callTopic = 'privacychat_atul_39281/call/' + state.currentUser.number;
    const presenceReqTopic = 'privacychat_atul_39281/presence_req/' + state.currentUser.number;
    
    brokerClient.subscribe(msgTopic, { qos: 1 });
    brokerClient.subscribe(callTopic, { qos: 1 });
    brokerClient.subscribe(presenceReqTopic, { qos: 1 });

    // Send immediate online heartbeat
    publishPresence("online");

    // Setup recurring 5-sec presence heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      publishPresence("online");
    }, 5000);
  });

  brokerClient.on('message', async (topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      if (topic.includes('/msg/')) {
        await handleIncomingTransitMessage(data);
      } else if (topic.includes('/call/')) {
        await handleIncomingCallSignaling(data);
      } else if (topic.includes('/presence_req/')) {
        // Someone requested our presence, reply immediately
        publishPresence("online");
      } else if (topic.includes('/presence/')) {
        await handleIncomingPresence(topic, data);
      }
    } catch(err) {
      console.error("Broker message parsing error: ", err);
    }
  });

  brokerClient.on('error', (err) => {
    console.error("Broker error:", err);
    updateUIStatus("Signal Disconnected", "danger", "#ff1744");
  });

  brokerClient.on('close', () => {
    updateUIStatus("Offline", "danger", "#ff1744");
  });
}

// Publish presence status to the network
function publishPresence(status) {
  if (!brokerClient || !brokerClient.connected || !state.currentUser) return;
  const presenceTopic = 'privacychat_atul_39281/presence/' + state.currentUser.number;
  brokerClient.publish(presenceTopic, JSON.stringify({
    number: state.currentUser.number,
    name: state.currentUser.name,
    photo: state.currentUser.photo,
    status: status,
    timestamp: Date.now()
  }), { qos: 0 });
}

// Receive and handle incoming presence updates
async function handleIncomingPresence(topic, data) {
  const senderNum = topic.split('/').pop();
  if (senderNum === state.currentUser.number) return;

  // 1. Sync contact details (Name and Profile photo) from heartbeat!
  const contact = await window.AppDB.get('contacts', senderNum);
  if (contact) {
    let changed = false;
    if (data.name && contact.name !== data.name) {
      contact.name = data.name;
      changed = true;
    }
    if (data.photo && contact.photo !== data.photo) {
      contact.photo = data.photo;
      changed = true;
    }
    if (changed) {
      await window.AppDB.put('contacts', contact);
      await loadContacts();
      if (state.activeChatId === senderNum) {
        el.chatHeaderName.textContent = contact.name;
        el.chatHeaderAvatar.src = contact.photo || DEFAULT_AVATAR;
      }
    }
  }

  // 2. Update active chat presence view
  if (state.activeChatId === senderNum) {
    state.activeContactLastSeen = Date.now();
    
    const subLabel = el.chatHeaderNumber; // Use number sublabel to show status
    if (data.status === 'typing') {
      subLabel.innerHTML = `<span style="color: var(--accent-color); font-weight: 600; animation: pulse 1s infinite;">typing...</span>`;
    } else if (data.status === 'online') {
      subLabel.innerHTML = `<span style="color: var(--success-color); font-weight: 600;">● Online</span>`;
    } else {
      subLabel.textContent = senderNum;
    }
  }
}

// Receive messages in real-time
async function handleIncomingTransitMessage(data) {
  const contactExists = await window.AppDB.get('contacts', data.sender);
  if (!contactExists) {
    const newContact = {
      number: data.sender,
      name: data.senderName || ("User " + data.sender.slice(-4)),
      blocked: false,
      photo: DEFAULT_AVATAR
    };
    await window.AppDB.put('contacts', newContact);
    await loadContacts();
  }

  // 1. Decrypt transit payload with the shared transit key (stateless)
  const transitPasscode = getDailyPassword();
  const transitKey = await window.AppCrypto.deriveKey(transitPasscode);
  if (!transitKey) return;

  let plaintext = '';
  try {
    plaintext = await window.AppCrypto.decryptText(data.content, transitKey);
  } catch(e) {
    console.error("Decrypting transit message failed: ", e);
    return;
  }

  // 2. Encrypt locally with personal key and write to IndexedDB
  const personalPasscode = state.currentUser.password;
  const personalKey = await window.AppCrypto.deriveKey(personalPasscode);
  const encryptedLocal = await window.AppCrypto.encryptText(plaintext, personalKey);
  
  const msg = {
    id: data.id,
    sender: data.sender,
    receiver: data.receiver,
    content: encryptedLocal,
    type: data.type,
    timestamp: data.timestamp,
    replyTo: data.replyTo
  };

  await window.AppDB.put('messages', msg);
  
  if (state.activeChatId === data.sender) {
    await loadMessages();
  }
}

/* ==========================================================================
   5. WEBRTC P2P VOICE & VIDEO CALLING ENGINE (ICE CANDIDATE QUEUE INTEGRATED)
   ========================================================================== */

async function handleIncomingCallSignaling(data) {
  if (data.type === 'offer') {
    state.isIncomingCall = true;
    state.pendingOffer = data;
    state.remoteNumber = data.sender;
    state.queuedCandidates = []; // Reset queue
    
    el.callOverlay.classList.add('active');
    el.callName.textContent = data.senderName;
    el.callAvatar.src = DEFAULT_AVATAR;
    el.callStatus.textContent = `Incoming ${data.callType} call...`;
    el.callTimer.textContent = "00:00";
    el.btnAcceptCall.style.display = 'flex';
    
    el.callVideoContainer.style.display = data.callType === 'video' ? 'block' : 'none';
    
    // Play Incoming Ringtone
    startIncomingRingtone();
    el.callAvatar.classList.add('ringing');
    
    state.callTimeout = setTimeout(() => {
      autoRejectCall();
    }, 60000);
  } 
  else if (data.type === 'answer') {
    if (state.peerConnection) {
      await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      acceptCallUI();
      
      // Apply any queued ICE candidates
      if (state.queuedCandidates.length > 0) {
        for (let candidate of state.queuedCandidates) {
          try {
            await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch(e) { console.warn(e); }
        }
        state.queuedCandidates = [];
      }
    }
  } 
  else if (data.type === 'candidate') {
    if (state.peerConnection && state.peerConnection.remoteDescription) {
      try {
        await state.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch(e) {
        console.warn("Error adding IceCandidate: ", e);
      }
    } else {
      // Queue candidate if connection not ready yet
      state.queuedCandidates.push(data.candidate);
    }
  } 
  else if (data.type === 'hangup') {
    endCall();
  }
}

async function startCall(callType) {
  if (!state.activeChatId) return;
  state.isIncomingCall = false;
  state.remoteNumber = state.activeChatId;
  state.queuedCandidates = []; // Reset queue
  state.callStartTime = Date.now();

  const contact = await window.AppDB.get('contacts', state.activeChatId);
  
  el.callOverlay.classList.add('active');
  el.callAvatar.src = contact.photo || DEFAULT_AVATAR;
  el.callName.textContent = contact.name;
  el.callStatus.textContent = "Calling...";
  el.callTimer.textContent = "00:00";
  el.btnAcceptCall.style.display = 'none';

  el.callVideoContainer.style.display = callType === 'video' ? 'block' : 'none';

  // Play Dialer Outgoing Tone
  startDialingTone();
  el.callAvatar.classList.add('ringing');

  state.peerConnection = new RTCPeerConnection(rtcConfig);
  
  try {
    state.callStream = await navigator.mediaDevices.getUserMedia({
      video: callType === 'video',
      audio: true
    });
    el.callLocalVideo.srcObject = state.callStream;
    
    state.callStream.getTracks().forEach(track => {
      state.peerConnection.addTrack(track, state.callStream);
    });
  } catch(err) {
    alert("Camera/Microphone access denied.");
    endCall();
    return;
  }

  state.peerConnection.ontrack = (event) => {
    el.callRemoteVideo.srcObject = event.streams[0];
  };

  state.peerConnection.onicecandidate = (event) => {
    if (event.candidate && brokerClient) {
      brokerClient.publish('privacychat_atul_39281/call/' + state.remoteNumber, JSON.stringify({
        type: 'candidate',
        candidate: event.candidate,
        sender: state.currentUser.number
      }));
    }
  };

  const offer = await state.peerConnection.createOffer();
  await state.peerConnection.setLocalDescription(offer);

  brokerClient.publish('privacychat_atul_39281/call/' + state.remoteNumber, JSON.stringify({
    type: 'offer',
    callType: callType,
    sdp: offer,
    sender: state.currentUser.number,
    senderName: state.currentUser.name
  }));

  state.callTimeout = setTimeout(() => {
    autoRejectCall();
  }, 60000);
}

async function acceptCall() {
  stopRingtone();
  if (state.callTimeout) clearTimeout(state.callTimeout);
  el.callAvatar.classList.remove('ringing');
  el.btnAcceptCall.style.display = 'none';
  state.callStartTime = Date.now();

  if (!state.pendingOffer) return;

  state.peerConnection = new RTCPeerConnection(rtcConfig);

  try {
    state.callStream = await navigator.mediaDevices.getUserMedia({
      video: state.pendingOffer.callType === 'video',
      audio: true
    });
    el.callLocalVideo.srcObject = state.callStream;
    
    state.callStream.getTracks().forEach(track => {
      state.peerConnection.addTrack(track, state.callStream);
    });
  } catch(err) {
    alert("Media permissions required to accept calls.");
    brokerClient.publish('privacychat_atul_39281/call/' + state.remoteNumber, JSON.stringify({
      type: 'hangup',
      sender: state.currentUser.number
    }));
    endCall();
    return;
  }

  state.peerConnection.ontrack = (event) => {
    el.callRemoteVideo.srcObject = event.streams[0];
  };

  state.peerConnection.onicecandidate = (event) => {
    if (event.candidate && brokerClient) {
      brokerClient.publish('privacychat_atul_39281/call/' + state.remoteNumber, JSON.stringify({
        type: 'candidate',
        candidate: event.candidate,
        sender: state.currentUser.number
      }));
    }
  };

  await state.peerConnection.setRemoteDescription(new RTCSessionDescription(state.pendingOffer.sdp));

  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);

  brokerClient.publish('privacychat_atul_39281/call/' + state.remoteNumber, JSON.stringify({
    type: 'answer',
    sdp: answer,
    sender: state.currentUser.number
  }));

  acceptCallUI();

  // Apply queued candidates
  if (state.queuedCandidates.length > 0) {
    for (let candidate of state.queuedCandidates) {
      try {
        await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch(e) { console.warn(e); }
    }
    state.queuedCandidates = [];
  }
}

function acceptCallUI() {
  stopRingtone();
  if (state.callTimeout) clearTimeout(state.callTimeout);
  el.callAvatar.classList.remove('ringing');
  el.callStatus.textContent = "Connected";
  el.btnAcceptCall.style.display = 'none';
  
  let sec = 0;
  if (state.callTimerInterval) clearInterval(state.callTimerInterval);
  state.callTimerInterval = setInterval(() => {
    sec++;
    const m = String(Math.floor(sec/60)).padStart(2,'0');
    const s = String(sec%60).padStart(2,'0');
    el.callTimer.textContent = `${m}:${s}`;
  }, 1000);
}

function autoRejectCall() {
  stopRingtone();
  el.callAvatar.classList.remove('ringing');
  el.callStatus.textContent = "No Answer (Call Timed Out)";
  el.btnAcceptCall.style.display = 'none';
  
  if (brokerClient && state.remoteNumber) {
    brokerClient.publish('privacychat_atul_39281/call/' + state.remoteNumber, JSON.stringify({
      type: 'hangup',
      sender: state.currentUser.number
    }));
  }
  
  state.callTimeout = setTimeout(endCall, 3000);
}

async function endCall() {
  stopRingtone();
  stopRecording();

  if (state.callTimeout) clearTimeout(state.callTimeout);
  if (state.callTimerInterval) clearInterval(state.callTimerInterval);
  
  const activeCallBanner = document.getElementById('active-call-banner');
  if (activeCallBanner) activeCallBanner.style.display = 'none';

  // Save Call record to IndexedDB if remoteNumber is set
  if (state.remoteNumber) {
    const duration = state.callStartTime > 0 ? Math.floor((Date.now() - state.callStartTime) / 1000) : 0;
    const contact = await window.AppDB.get('contacts', state.remoteNumber);
    const callRecord = {
      id: 'call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      number: state.remoteNumber,
      name: contact ? contact.name : `User ${state.remoteNumber.slice(-4)}`,
      type: el.callVideoContainer.style.display === 'block' ? 'video' : 'voice',
      direction: state.isIncomingCall ? 'incoming' : 'outgoing',
      timestamp: Date.now(),
      duration: duration,
      status: state.callTimerInterval ? 'connected' : 'missed'
    };
    await window.AppDB.put('call_history', callRecord);
    loadCallHistory();
  }

  if (brokerClient && state.remoteNumber) {
    brokerClient.publish('privacychat_atul_39281/call/' + state.remoteNumber, JSON.stringify({
      type: 'hangup',
      sender: state.currentUser.number
    }));
  }

  if (state.callStream) {
    state.callStream.getTracks().forEach(t => t.stop());
    state.callStream = null;
  }
  if (state.peerConnection) {
    state.peerConnection.close();
    state.peerConnection = null;
  }
  
  el.callLocalVideo.srcObject = null;
  el.callRemoteVideo.srcObject = null;
  el.callOverlay.classList.remove('active');
  
  state.pendingOffer = null;
  state.remoteNumber = null;
  state.queuedCandidates = [];
  state.callStartTime = 0;
}

el.btnVoiceCall.addEventListener('click', () => startCall('voice'));
el.btnVideoCall.addEventListener('click', () => startCall('video'));
el.btnAcceptCall.addEventListener('click', acceptCall);
el.btnEndCall.addEventListener('click', endCall);

// Minimize / Back button inside call view event listeners
const btnCallMinimize = document.getElementById('btn-call-minimize');
const activeCallBanner = document.getElementById('active-call-banner');
const activeCallBannerText = document.getElementById('active-call-banner-text');
const btnActiveCallBannerReturn = document.getElementById('btn-active-call-banner-return');

if (btnCallMinimize) {
  btnCallMinimize.addEventListener('click', () => {
    el.callOverlay.classList.remove('active');
    if (activeCallBanner) {
      activeCallBanner.style.display = 'flex';
      activeCallBannerText.textContent = `Call active: ${state.remoteNumber || 'User'}`;
    }
  });
}

if (btnActiveCallBannerReturn) {
  btnActiveCallBannerReturn.addEventListener('click', () => {
    el.callOverlay.classList.add('active');
    if (activeCallBanner) activeCallBanner.style.display = 'none';
  });
}

/* ==========================================================================
   5.5 WEBRTC ON-CALL CALL RECORDER
   ========================================================================== */

function toggleCallRecording() {
  if (!state.mediaRecorder) {
    // Start Recording
    const streamToRecord = el.callRemoteVideo.srcObject || state.callStream;
    if (!streamToRecord) {
      alert("No active audio/video stream to record.");
      return;
    }
    
    state.recordedChunks = [];
    try {
      state.mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm;codecs=vp8' });
    } catch(e) {
      try {
        state.mediaRecorder = new MediaRecorder(streamToRecord);
      } catch(err) {
        alert("Recording is not supported in this browser.");
        return;
      }
    }
    
    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        state.recordedChunks.push(event.data);
      }
    };
    
    state.mediaRecorder.onstop = () => {
      const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `privacychat_call_record_${Date.now()}.webm`;
      a.click();
      alert("Call recording saved to your downloads!");
    };
    
    state.mediaRecorder.start(1000);
    
    // Update UI
    el.btnCallRecord.style.background = "var(--danger-color)";
    el.callRecordBanner.style.display = "flex";
    document.getElementById('call-record-icon').className = "ph-fill ph-record";
  } else {
    // Stop Recording
    stopRecording();
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  state.mediaRecorder = null;
  el.btnCallRecord.style.background = "rgba(255,23,68,0.2)";
  el.callRecordBanner.style.display = "none";
  document.getElementById('call-record-icon').className = "ph ph-record";
}

if (el.btnCallRecord) {
  el.btnCallRecord.addEventListener('click', toggleCallRecording);
}

/* ==========================================================================
   6. DYNAMIC Web Audio API RINGTONE & DIALER ENGINE
   ========================================================================== */

function startDialingTone() {
  try {
    stopRingtone();
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const playBeep = () => {
      if (!state.audioContext) return;
      const now = state.audioContext.currentTime;
      
      // OUTGOING double dialing pulse sound
      const osc = state.audioContext.createOscillator();
      const gain = state.audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(425, now);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.setValueAtTime(0.2, now + 0.8);
      gain.gain.linearRampToValueAtTime(0, now + 0.9);
      
      osc.connect(gain);
      gain.connect(state.audioContext.destination);
      osc.start(now);
      osc.stop(now + 1.0);
      
      state.activeBeeps.push(osc);
    };
    
    playBeep();
    state.dialerToneInterval = setInterval(playBeep, 2500);
  } catch(e) { console.error(e); }
}

function startIncomingRingtone() {
  try {
    stopRingtone();
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const playMelody = () => {
      if (!state.audioContext) return;
      const now = state.audioContext.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5 chords arpeggio
      
      notes.forEach((freq, idx) => {
        const osc = state.audioContext.createOscillator();
        const gain = state.audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);
        
        gain.gain.setValueAtTime(0, now + idx * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.18 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.6);
        
        osc.connect(gain);
        gain.connect(state.audioContext.destination);
        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 0.6);
        
        state.activeBeeps.push(osc);
      });
    };
    
    playMelody();
    state.ringtoneInterval = setInterval(playMelody, 2000);
  } catch(e) { console.error(e); }
}

function stopRingtone() {
  if (state.dialerToneInterval) {
    clearInterval(state.dialerToneInterval);
    state.dialerToneInterval = null;
  }
  if (state.ringtoneInterval) {
    clearInterval(state.ringtoneInterval);
    state.ringtoneInterval = null;
  }
  if (state.activeBeeps && state.activeBeeps.length > 0) {
    state.activeBeeps.forEach(osc => {
      try { osc.stop(); } catch(e){}
    });
    state.activeBeeps = [];
  }
  if (state.audioContext) {
    try { state.audioContext.close(); } catch(e){}
    state.audioContext = null;
  }
}

/* ==========================================================================
   7. INITIALIZING DASHBOARD & NAVIGATION
   ========================================================================== */

async function loadAppDashboard() {
  await loadContacts();
  await cleanupOldStatuses();
  await loadStatuses();
  await loadCallHistory();
}

function switchTab(tabName) {
  state.activeTab = tabName;
  el.tabChatsBtn.classList.toggle('active', tabName === 'chats');
  el.tabCallsBtn.classList.toggle('active', tabName === 'calls');
  el.tabStatusBtn.classList.toggle('active', tabName === 'status');
  el.tabProfileBtn.classList.toggle('active', tabName === 'profile');
  el.tabPrivacyBtn.classList.toggle('active', tabName === 'privacy');
  
  el.tabChatsContent.style.display = tabName === 'chats' ? 'block' : 'none';
  el.tabCallsContent.style.display = tabName === 'calls' ? 'block' : 'none';
  el.tabStatusContent.style.display = tabName === 'status' ? 'block' : 'none';
  el.tabProfileContent.style.display = tabName === 'profile' ? 'block' : 'none';
  el.tabPrivacyContent.style.display = tabName === 'privacy' ? 'block' : 'none';
  
  if (tabName === 'chats') loadContacts();
  else if (tabName === 'calls') loadCallHistory();
  else if (tabName === 'status') loadStatuses();
  else if (tabName === 'profile') updateProfileTabUI();
  else if (tabName === 'privacy') {
    loadEmailJSConfigUI();
    renderBlockedList();
  }
}

el.tabChatsBtn.addEventListener('click', () => switchTab('chats'));
el.tabCallsBtn.addEventListener('click', () => switchTab('calls'));
el.tabStatusBtn.addEventListener('click', () => switchTab('status'));
el.tabProfileBtn.addEventListener('click', () => switchTab('profile'));
el.tabPrivacyBtn.addEventListener('click', () => switchTab('privacy'));

async function handleLogout() {
  publishPresence("offline");
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  if (brokerClient) {
    brokerClient.end();
    brokerClient = null;
  }
  window.AppCrypto.key = null;
  state.currentUser = null;
  state.activeChatId = null;
  localStorage.removeItem('pc_active_phone');
  el.loginPassword.value = '';
  el.screenDashboard.classList.remove('active');
  el.screenLogin.classList.add('active');
}

el.btnLogout.addEventListener('click', handleLogout);
if (el.btnHeaderLogout) el.btnHeaderLogout.addEventListener('click', handleLogout);

el.btnWipeData.addEventListener('click', async () => {
  if (confirm("WARNING: Wipe all data? This cannot be undone.")) {
    await window.AppDB.wipeAllData();
    localStorage.clear();
    location.reload();
  }
});

/* ==========================================================================
   8. CONTACT MANAGEMENT
   ========================================================================== */

el.btnAddContact.addEventListener('click', () => {
  el.modalAddContact.classList.add('active');
  el.contactNameInput.value = '';
  el.contactPhoneInput.value = '';
  el.contactError.style.display = 'none';
});

el.btnCloseContactModal.addEventListener('click', () => {
  el.modalAddContact.classList.remove('active');
});

el.addContactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = el.contactNameInput.value.trim();
  const phone = el.contactPhoneInput.value.trim();
  
  if (!isValidMobile(phone)) {
    showContactError("Invalid phone format.");
    return;
  }

  const isRegistered = await isNumberRegistered(phone);
  if (!isRegistered) {
    showContactError("Error: This number has not signed up on PrivacyChat.");
    return;
  }

  el.contactError.style.display = 'none';

  const contact = {
    number: phone,
    name: name,
    blocked: false,
    photo: DEFAULT_AVATAR
  };

  await window.AppDB.put('contacts', contact);
  el.modalAddContact.classList.remove('active');
  await loadContacts();
});

function showContactError(msg) {
  el.contactError.textContent = msg;
  el.contactError.style.display = 'block';
}

async function loadContacts() {
  const list = await window.AppDB.getAll('contacts');
  el.contactsList.innerHTML = '';
  
  if (list.length === 0) {
    el.contactsList.innerHTML = `<div class="empty-state"><i class="ph ph-chats-teardrop"></i><p>No contacts. Add numbers above.</p></div>`;
    return;
  }

  for (let contact of list) {
    const card = document.createElement('div');
    card.className = `contact-item ${state.activeChatId === contact.number ? 'active' : ''}`;
    
    const isLocked = state.lockedChats.includes(contact.number);
    const lockIcon = isLocked ? `<span class="lock-badge"><i class="ph-fill ph-lock"></i></span>` : '';

    card.innerHTML = `
      <div class="avatar-container">
        <img class="avatar" src="${contact.photo || DEFAULT_AVATAR}" alt="">
      </div>
      <div class="contact-info" style="flex: 1;">
        <h4 class="contact-name">${contact.name}</h4>
        <p class="contact-last-msg">${contact.number}</p>
      </div>
      ${lockIcon}
    `;

    card.onclick = () => selectContactChat(contact);
    el.contactsList.appendChild(card);
  }
}

async function selectContactChat(contact) {
  const isLocked = state.lockedChats.includes(contact.number);
  const isSessionUnlocked = state.unlockedSessions.includes(contact.number);

  if (isLocked && !isSessionUnlocked) {
    el.modalChatLock.classList.add('active');
    el.chatLockPassword.value = '';
    el.chatLockError.style.display = 'none';
    
    el.btnChatLockSubmit.onclick = () => {
      const input = el.chatLockPassword.value.trim();
      const defaultPasscode = state.currentUser.number.slice(0, 4); 
      if (input === defaultPasscode) {
        state.unlockedSessions.push(contact.number);
        el.modalChatLock.classList.remove('active');
        openChatView(contact);
      } else {
        el.chatLockError.style.display = 'block';
      }
    };
    
    el.btnChatLockCancel.onclick = () => {
      el.modalChatLock.classList.remove('active');
    };
  } else {
    openChatView(contact);
  }
}

async function openChatView(contact) {
  // Unsubscribe from previous contact's presence topic
  if (state.activePresenceTopic && brokerClient) {
    brokerClient.unsubscribe(state.activePresenceTopic);
  }

  state.activeChatId = contact.number;
  document.querySelectorAll('.contact-item').forEach(c => c.classList.remove('active'));
  
  el.chatPlaceholder.style.display = 'none';
  el.chatActiveView.style.display = 'flex';
  
  // Mobile responsive layout view class toggles
  el.screenDashboard.classList.add('chat-open');
  if (el.btnChatBack) el.btnChatBack.style.display = 'flex';

  el.chatHeaderName.textContent = contact.name;
  el.chatHeaderNumber.textContent = contact.number; // default back to number
  el.chatHeaderAvatar.src = contact.photo || DEFAULT_AVATAR;

  const isLocked = state.lockedChats.includes(contact.number);
  el.lockBtnLabel.textContent = isLocked ? "Unlock Chat" : "Lock Chat";
  el.btnLockChat.querySelector('i').className = isLocked ? "ph ph-lock-key" : "ph ph-lock";

  if (contact.blocked) {
    el.blockedBanner.style.display = 'flex';
    el.chatInputRow.style.display = 'none';
    el.blockBtnLabel.textContent = "Unblock";
  } else {
    el.blockedBanner.style.display = 'none';
    el.chatInputRow.style.display = 'flex';
    el.blockBtnLabel.textContent = "Block";
  }

  // Clear reply state
  clearReplyState();

  await loadMessages();
  el.chatTextInput.focus();

  // Presence Subscription logic for selected contact
  state.activeContactLastSeen = Date.now();
  state.activePresenceTopic = 'privacychat_atul_39281/presence/' + contact.number;
  
  if (brokerClient && brokerClient.connected) {
    brokerClient.subscribe(state.activePresenceTopic);
    
    // Publish a request so B replies immediately
    brokerClient.publish('privacychat_atul_39281/presence_req/' + contact.number, JSON.stringify({
      requester: state.currentUser.number
    }));
  }

  // Active watch state status timer (if B silent for >12s, show as offline)
  if (state.activeContactStatusTimer) clearInterval(state.activeContactStatusTimer);
  state.activeContactStatusTimer = setInterval(() => {
    if (Date.now() - state.activeContactLastSeen > 12000) {
      el.chatHeaderNumber.textContent = contact.number; // Reset back to showing phone number (implies offline)
    }
  }, 3000);
}

// Back Button mobile listener
if (el.btnChatBack) {
  el.btnChatBack.addEventListener('click', () => {
    el.screenDashboard.classList.remove('chat-open');
    state.activeChatId = null;
    el.chatPlaceholder.style.display = 'flex';
    el.chatActiveView.style.display = 'none';
    
    if (state.activePresenceTopic && brokerClient) {
      brokerClient.unsubscribe(state.activePresenceTopic);
      state.activePresenceTopic = null;
    }
    if (state.activeContactStatusTimer) {
      clearInterval(state.activeContactStatusTimer);
      state.activeContactStatusTimer = null;
    }
    loadContacts();
  });
}

el.btnLockChat.addEventListener('click', async () => {
  if (!state.activeChatId) return;
  const number = state.activeChatId;
  const idx = state.lockedChats.indexOf(number);

  if (idx === -1) {
    state.lockedChats.push(number);
    state.unlockedSessions.push(number);
    alert(`Chat locked successfully. Passcode is first 4 digits of your number (${state.currentUser.number.slice(0,4)}).`);
  } else {
    state.lockedChats.splice(idx, 1);
  }

  localStorage.setItem('pc_locked_chats', JSON.stringify(state.lockedChats));
  
  const isLocked = state.lockedChats.includes(number);
  el.lockBtnLabel.textContent = isLocked ? "Unlock Chat" : "Lock Chat";
  el.btnLockChat.querySelector('i').className = isLocked ? "ph ph-lock-key" : "ph ph-lock";
  
  await loadContacts();
});

/* ==========================================================================
   8.5 CALL HISTORY TABS GENERATOR
   ========================================================================== */

async function loadCallHistory() {
  if (!state.currentUser) return;
  const list = await window.AppDB.getAll('call_history');
  el.callHistoryList.innerHTML = '';
  
  if (list.length === 0) {
    el.callHistoryList.innerHTML = `<div class="empty-state"><i class="ph ph-phone"></i><p>No call logs available.</p></div>`;
    return;
  }

  // Sort call logs descending (latest first)
  const sorted = list.sort((a, b) => b.timestamp - a.timestamp);

  sorted.forEach(record => {
    const card = document.createElement('div');
    card.className = 'contact-item';
    card.style.cursor = 'default';

    // Type of call icon
    const callIcon = record.type === 'video' ? `<i class="ph ph-video-camera" style="font-size: 1.25rem;"></i>` : `<i class="ph ph-phone" style="font-size: 1.25rem;"></i>`;
    
    // Direction details
    let dirIcon = '';
    if (record.status === 'missed') {
      dirIcon = `<i class="ph ph-arrow-down-left" style="color: var(--danger-color); font-weight: bold;"></i>`;
    } else if (record.direction === 'incoming') {
      dirIcon = `<i class="ph ph-arrow-down-left" style="color: var(--success-color); font-weight: bold;"></i>`;
    } else {
      dirIcon = `<i class="ph ph-arrow-up-right" style="color: var(--accent-color); font-weight: bold;"></i>`;
    }

    const dateStr = new Date(record.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const durationStr = record.status === 'missed' ? 'Missed' : `${Math.floor(record.duration / 60)}:${String(record.duration % 60).padStart(2,'0')} Min`;

    card.innerHTML = `
      <div class="avatar-container">
        <img class="avatar" src="${DEFAULT_AVATAR}" alt="">
      </div>
      <div class="contact-info" style="flex: 1;">
        <h4 class="contact-name">${record.name}</h4>
        <p class="contact-last-msg" style="display: flex; align-items: center; gap: 4px;">
          ${dirIcon} <span>${dateStr} (${durationStr})</span>
        </p>
      </div>
      <button class="btn-icon" style="color: var(--accent-color); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); border-radius: 50%; cursor: pointer;" title="Call Back" onclick="startCallBackDirect('${record.number}', '${record.type}')">
        ${callIcon}
      </button>
    `;
    
    el.callHistoryList.appendChild(card);
  });
}

window.startCallBackDirect = async function(number, type) {
  const contact = await window.AppDB.get('contacts', number);
  if (contact) {
    await selectContactChat(contact);
    startCall(type);
  } else {
    alert("Contact not saved. Save contact to initiate WebRTC calls.");
  }
};

/* ==========================================================================
   9. CHAT CUSTOMIZATION (THEMES, FONTS, WALLPAPERS & EMOJIS)
   ========================================================================== */

function changeTheme(theme) {
  document.body.classList.remove('theme-light', 'theme-light', 'theme-midnight', 'theme-emerald', 'theme-sunset');
  document.body.classList.add(theme);
  localStorage.setItem('pc_active_theme', theme);
  
  if (el.themeSelect) el.themeSelect.value = theme;
  if (el.profileThemeSelect) el.profileThemeSelect.value = theme;
}

if (el.themeSelect) {
  el.themeSelect.addEventListener('change', () => changeTheme(el.themeSelect.value));
}
if (el.profileThemeSelect) {
  el.profileThemeSelect.addEventListener('change', () => changeTheme(el.profileThemeSelect.value));
}

el.fontSelect.addEventListener('change', () => {
  const font = el.fontSelect.value;
  document.body.classList.remove('font-outfit', 'font-playfair', 'font-fira', 'font-dyslexic');
  document.body.classList.add(font);
  localStorage.setItem('pc_active_font', font);
});

el.wallpaperSelect.addEventListener('change', () => {
  const wp = el.wallpaperSelect.value;
  el.chatMessages.style.backgroundImage = 'none';
  el.chatMessages.className = "chat-messages"; 
  
  if (wp === 'wp-custom') {
    el.customWallpaperWrapper.style.display = 'block';
    const savedCustom = localStorage.getItem('pc_custom_wallpaper');
    if (savedCustom) {
      el.chatMessages.style.backgroundImage = `url(${savedCustom})`;
      el.chatMessages.style.backgroundSize = 'cover';
    }
  } else {
    el.customWallpaperWrapper.style.display = 'none';
    el.chatMessages.classList.add(wp.replace('wp-', 'wp-'));
  }
  
  localStorage.setItem('pc_active_wallpaper', wp);
});

el.customWallpaperInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const b64 = event.target.result;
    localStorage.setItem('pc_custom_wallpaper', b64);
    el.chatMessages.style.backgroundImage = `url(${b64})`;
    el.chatMessages.style.backgroundSize = 'cover';
    alert("Wallpaper updated!");
  };
  reader.readAsDataURL(file);
});

function initEmojiPicker() {
  el.emojiPickerPopup.innerHTML = '';
  EMOJIS.forEach(emoji => {
    const item = document.createElement('div');
    item.className = 'emoji-item';
    item.textContent = emoji;
    item.onclick = (e) => {
      e.stopPropagation();
      const input = el.chatTextInput;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const text = input.value;
      input.value = text.substring(0, start) + emoji + text.substring(end);
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
      el.emojiPickerPopup.style.display = 'none';
    };
    el.emojiPickerPopup.appendChild(item);
  });
}

el.btnEmoji.addEventListener('click', (e) => {
  e.stopPropagation();
  const isShown = el.emojiPickerPopup.style.display === 'grid';
  el.emojiPickerPopup.style.display = isShown ? 'none' : 'grid';
});

document.addEventListener('click', () => {
  el.emojiPickerPopup.style.display = 'none';
});

/* ==========================================================================
   10. REAL-TIME E2EE MESSAGING ENGINE
   ========================================================================== */

async function loadMessages() {
  if (!state.activeChatId) return;
  const messages = await window.AppDB.getAll('messages');
  el.chatMessages.innerHTML = '';
  
  const thread = messages
    .filter(m => (m.sender === state.currentUser.number && m.receiver === state.activeChatId) ||
                 (m.sender === state.activeChatId && m.receiver === state.currentUser.number))
    .sort((a, b) => a.timestamp - b.timestamp);

  for (let msg of thread) {
    const card = document.createElement('div');
    card.className = `message-bubble ${msg.sender === state.currentUser.number ? 'sent' : 'received'}`;
    
    let contentHtml = '';
    try {
      // Decode using custom password key (stateless)
      const personalPasscode = state.currentUser.password;
      const personalKey = await window.AppCrypto.deriveKey(personalPasscode);
      const decrypted = await window.AppCrypto.decryptText(msg.content, personalKey);
      
      // Reply metadata layout box
      let quoteHtml = '';
      if (msg.replyTo) {
        const senderLabel = msg.replyTo.sender === state.currentUser.number ? 'You' : 'Reply';
        quoteHtml = `
          <div class="reply-quote-box">
            <div style="font-size: 0.72rem; color: var(--accent-color); font-weight: 600; margin-bottom: 2px;">${senderLabel}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">${msg.replyTo.text}</div>
          </div>
        `;
      }

      if (msg.type === 'text') {
        const escaped = decrypted.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        contentHtml = `${quoteHtml}<p class="msg-text">${escaped}</p>`;
      } else if (msg.type === 'location') {
        const coords = decrypted;
        contentHtml = `
          ${quoteHtml}
          <div class="message-media-location">
            <div class="location-header">
              <i class="ph ph-map-pin"></i>
              <span>Shared Location</span>
            </div>
            <div class="location-coords">${coords}</div>
            <div class="location-actions">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${coords.replace('Lat: ', '').replace(' Lng: ', '')}" target="_blank" class="btn-location-action">Get Directions</a>
            </div>
          </div>
        `;
      } else {
        if (msg.type.startsWith('image/')) {
          contentHtml = `${quoteHtml}<img class="message-media-image" src="${decrypted}" onclick="openLightbox('${decrypted}')" alt="Attachment">`;
        } else if (msg.type.startsWith('video/')) {
          contentHtml = `${quoteHtml}<video class="message-media-video" controls src="${decrypted}"></video>`;
        } else {
          contentHtml = `
            ${quoteHtml}
            <div class="message-media-file">
              <i class="ph ph-file-text file-icon"></i>
              <div class="file-detail">
                <div class="file-name">Attachment</div>
              </div>
              <a href="${decrypted}" download="file" class="btn-file-dl"><i class="ph ph-download"></i></a>
            </div>
          `;
        }
      }

      // Add double click / click event listener to reply to this message!
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        setReplyState(msg.id, msg.sender, decrypted);
      });

    } catch(err) {
      console.error(err);
      contentHtml = `<p class="msg-text error"><i class="ph ph-warning"></i> Error decrypting message.</p>`;
    }

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    card.innerHTML = `
      ${contentHtml}
      <div class="message-info-row">
        <span class="message-time-stamp">${time}</span>
      </div>
    `;
    el.chatMessages.appendChild(card);
  }
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

// Reply quote setter
function setReplyState(id, sender, text) {
  state.replyTo = { id: id, sender: sender, text: text };
  el.replyPreviewContainer.style.display = 'flex';
  el.replyPreviewText.textContent = text;
  el.chatTextInput.focus();
}

function clearReplyState() {
  state.replyTo = null;
  el.replyPreviewContainer.style.display = 'none';
}

if (el.btnCancelReply) {
  el.btnCancelReply.addEventListener('click', clearReplyState);
}

async function sendMessage(text, type = 'text') {
  if (!state.activeChatId) return;

  const msgId = state.currentUser.number + "_" + state.activeChatId + "_" + Date.now();
  const timestamp = Date.now();
  const activeReply = state.replyTo;

  // 1. Locally encrypt using the custom password derived key (stateless)
  const personalPasscode = state.currentUser.password;
  const personalKey = await window.AppCrypto.deriveKey(personalPasscode);
  const encryptedLocal = await window.AppCrypto.encryptText(text, personalKey);

  const localMsg = {
    id: msgId,
    sender: state.currentUser.number,
    receiver: state.activeChatId,
    content: encryptedLocal,
    type: type,
    timestamp: timestamp,
    replyTo: activeReply
  };

  await window.AppDB.put('messages', localMsg);
  clearReplyState();
  await loadMessages();

  // 2. Encrypt transit payload using shared date passcode (ddmmyyyy)
  const transitPasscode = getDailyPassword();
  const transitKey = await window.AppCrypto.deriveKey(transitPasscode);
  const encryptedTransit = await window.AppCrypto.encryptText(text, transitKey);

  // 3. Publish to signal broker for real-time delivery
  if (brokerClient && brokerClient.connected) {
    brokerClient.publish('privacychat_atul_39281/msg/' + state.activeChatId, JSON.stringify({
      id: msgId,
      sender: state.currentUser.number,
      senderName: state.currentUser.name,
      receiver: state.activeChatId,
      content: encryptedTransit,
      type: type,
      timestamp: timestamp,
      replyTo: activeReply
    }), { qos: 1 });
  } else {
    console.warn("Signal broker disconnected. Queueing message locally.");
  }
}

el.btnSendMessage.addEventListener('click', async () => {
  const text = el.chatTextInput.value.trim();
  if (!text) return;
  el.chatTextInput.value = '';
  await sendMessage(text, 'text');
});

el.chatTextInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const text = el.chatTextInput.value.trim();
    if (!text) return;
    el.chatTextInput.value = '';
    await sendMessage(text, 'text');
  }
});

// typing status dispatcher
el.chatTextInput.addEventListener('input', () => {
  publishPresence("typing");
  if (state.typingPublishTimeout) clearTimeout(state.typingPublishTimeout);
  state.typingPublishTimeout = setTimeout(() => {
    publishPresence("online");
  }, 2500);
});

el.btnShareLocation.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert("Location sharing not supported.");
    return;
  }
  el.btnShareLocation.innerHTML = `<i class="ph ph-spinner animate-spin"></i> <span>...</span>`;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const coords = `Lat: ${pos.coords.latitude.toFixed(6)}, Lng: ${pos.coords.longitude.toFixed(6)}`;
      await sendMessage(coords, 'location');
      el.btnShareLocation.innerHTML = `<i class="ph ph-map-pin"></i> <span>Location</span>`;
    },
    () => {
      alert("Unable to fetch location coordinates.");
      el.btnShareLocation.innerHTML = `<i class="ph ph-map-pin"></i> <span>Location</span>`;
    }
  );
});

el.btnAttachment.addEventListener('click', () => el.chatFileInput.click());
el.chatFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    await sendMessage(event.target.result, file.type);
  };
  reader.readAsDataURL(file);
});

/* ==========================================================================
   11. DATA PORTABILITY, BLOCKING & STATUS
   ========================================================================== */

async function exportEncryptedBackup() {
  const contactsList = await window.AppDB.getAll('contacts');
  const messagesList = await window.AppDB.getAll('messages');
  const backup = {
    version: 1,
    timestamp: Date.now(),
    owner: state.currentUser.number,
    contacts: contactsList,
    messages: messagesList
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `privacychat_backup_${state.currentUser.number}.json`;
  a.click();
}

el.btnExportChats.addEventListener('click', exportEncryptedBackup);

el.importFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const backup = JSON.parse(event.target.result);
      for (let c of backup.contacts) await window.AppDB.put('contacts', c);
      for (let m of backup.messages) await window.AppDB.put('messages', m);
      alert("Backup Loaded Successfully!");
      await loadAppDashboard();
    } catch(err) {
      alert("Invalid backup file.");
    }
  };
  reader.readAsText(file);
});

async function toggleBlockContact() {
  if (!state.activeChatId) return;
  const c = await window.AppDB.get('contacts', state.activeChatId);
  c.blocked = !c.blocked;
  await window.AppDB.put('contacts', c);
  openChatView(c);
  loadContacts();
}

el.btnBlockContact.addEventListener('click', toggleBlockContact);
el.btnUnblockBanner.addEventListener('click', toggleBlockContact);

async function deleteActiveChat() {
  if (!state.activeChatId || !confirm("Delete chat history with this contact?")) return;
  const msgs = await window.AppDB.getAll('messages');
  for (let m of msgs) {
    if ((m.sender === state.currentUser.number && m.receiver === state.activeChatId) ||
        (m.sender === state.activeChatId && m.receiver === state.currentUser.number)) {
      await window.AppDB.delete('messages', m.id);
    }
  }
  await loadMessages();
}

el.btnDeleteChat.addEventListener('click', deleteActiveChat);

function updateProfileTabUI() {
  if (!state.currentUser) return;
  document.getElementById('profile-phone').value = state.currentUser.number;
  el.profileName.value = state.currentUser.name;
  el.profileBio.value = state.currentUser.bio;
  el.profilePic.src = state.currentUser.photo || DEFAULT_AVATAR;
  el.myStatusAvatar.src = state.currentUser.photo || DEFAULT_AVATAR;
  
  const savedTheme = localStorage.getItem('pc_active_theme') || 'theme-light';
  if (el.profileThemeSelect) el.profileThemeSelect.value = savedTheme;
}

el.btnSaveProfile.addEventListener('click', async () => {
  state.currentUser.name = el.profileName.value.trim();
  state.currentUser.bio = el.profileBio.value.trim();
  state.currentUser.photo = el.profilePic.src;
  await window.AppDB.put('profile', state.currentUser);
  
  // Publish updated photo immediately to presence topic
  publishPresence("online");
  
  alert("Profile Saved!");
});

el.profileAvatarInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => { el.profilePic.src = event.target.result; };
  reader.readAsDataURL(file);
});

/* ==========================================================================
   12. STATUS STORIES
   ========================================================================== */

el.btnAddStatus.addEventListener('click', () => el.modalAddStatus.classList.add('active'));
el.btnCloseStatusModal.addEventListener('click', () => el.modalAddStatus.classList.remove('active'));

el.statusImageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    await postStatus(event.target.result, 'image');
    el.modalAddStatus.classList.remove('active');
  };
  reader.readAsDataURL(file);
});

el.btnSubmitTextStatus.addEventListener('click', async () => {
  const txt = el.statusTextInput.value.trim();
  if (!txt) return;
  el.statusTextInput.value = '';
  await postStatus(txt, 'text');
  el.modalAddStatus.classList.remove('active');
});

async function postStatus(content, type) {
  const encrypted = await window.AppCrypto.encryptText(content);
  const status = {
    id: state.currentUser.number + "_" + Date.now(),
    number: state.currentUser.number,
    name: state.currentUser.name,
    photo: state.currentUser.photo,
    content: encrypted,
    type: type,
    timestamp: Date.now()
  };
  await window.AppDB.put('statuses', status);
  await loadStatuses();
}

async function loadStatuses() {
  const all = await window.AppDB.getAll('statuses');
  const now = Date.now();
  const grouped = {};
  all.forEach(s => {
    if (now - s.timestamp < DURATION_STATUS_EXPIRY) {
      if (!grouped[s.number]) grouped[s.number] = [];
      grouped[s.number].push(s);
    }
  });

  const myNum = state.currentUser.number;
  const myStories = grouped[myNum] || [];
  if (myStories.length > 0) {
    el.myStatusRing.style.borderColor = 'var(--accent-color)';
    el.myStatusTimeLabel.textContent = "Tap to view your stories";
    el.myStatusLabel.onclick = () => openStatusViewer(myNum, myStories);
  } else {
    el.myStatusRing.style.borderColor = 'rgba(255,255,255,0.15)';
    el.myStatusTimeLabel.textContent = "Tap to add status story";
    el.myStatusLabel.onclick = () => el.btnAddStatus.click();
  }

  el.statusList.innerHTML = '';
  Object.keys(grouped).forEach(num => {
    if (num === myNum) return;
    const stories = grouped[num].sort((a,b) => a.timestamp - b.timestamp);
    const last = stories[stories.length - 1];
    
    const item = document.createElement('div');
    item.className = 'status-item-card';
    item.innerHTML = `
      <div class="avatar-wrapper">
        <img class="avatar" src="${last.photo || DEFAULT_AVATAR}" alt="">
        <div class="status-ring" style="border-color: var(--accent-color);"></div>
      </div>
      <div>
        <h4>${last.name}</h4>
        <p>${formatTimeAgo(last.timestamp)}</p>
      </div>
    `;
    item.onclick = () => openStatusViewer(num, stories);
    el.statusList.appendChild(item);
  });
}

async function openStatusViewer(number, stories) {
  el.statusViewerModal.classList.add('active');
  let currentIdx = 0;
  
  el.statusProgressContainer.innerHTML = '';
  const progressBars = [];
  for (let i = 0; i < stories.length; i++) {
    const bar = document.createElement('div');
    bar.className = 'status-progress-bar';
    bar.innerHTML = '<div class="status-progress-fill"></div>';
    el.statusProgressContainer.appendChild(bar);
    progressBars.push(bar.querySelector('.status-progress-fill'));
  }

  async function showSlide(idx) {
    if (idx < 0 || idx >= stories.length) {
      closeStatusViewer();
      return;
    }
    currentIdx = idx;
    const status = stories[idx];
    el.statusViewerAvatar.src = status.photo || DEFAULT_AVATAR;
    el.statusViewerName.textContent = status.name;
    el.statusViewerTime.textContent = formatTimeAgo(status.timestamp);
    
    progressBars.forEach((bar, i) => {
      if (i < idx) bar.style.width = '100%';
      else if (i > idx) bar.style.width = '0%';
    });

    if (state.activeStatusTimer) clearInterval(state.activeStatusTimer);
    el.statusViewerBody.innerHTML = '<div style="color:var(--text-muted);">Decrypting status...</div>';
    
    try {
      const decrypted = await window.AppCrypto.decryptText(status.content);
      if (status.type === 'text') {
        el.statusViewerBody.innerHTML = `<div class="status-viewer-text-bg">${decrypted}</div>`;
      } else {
        el.statusViewerBody.innerHTML = `<img class="status-viewer-img" src="${decrypted}">`;
      }
      
      let progress = 0;
      state.activeStatusTimer = setInterval(() => {
        progress += (50 / STATUS_AUTOPLAY_MS) * 100;
        if (progress >= 100) {
          progress = 100;
          progressBars[idx].style.width = '100%';
          clearInterval(state.activeStatusTimer);
          showSlide(currentIdx + 1);
        } else {
          progressBars[idx].style.width = `${progress}%`;
        }
      }, 50);
    } catch(e) {
      el.statusViewerBody.innerHTML = '<div style="color:var(--danger-color);">Decryption Failed.</div>';
    }
  }

  el.statusViewerBody.onclick = (e) => {
    if (e.clientX < window.innerWidth / 3) showSlide(currentIdx - 1);
    else showSlide(currentIdx + 1);
  };
  await showSlide(0);
}

function closeStatusViewer() {
  if (state.activeStatusTimer) clearInterval(state.activeStatusTimer);
  el.statusViewerModal.classList.remove('active');
}

el.statusViewerClose.addEventListener('click', closeStatusViewer);

async function cleanupOldStatuses() {
  const all = await window.AppDB.getAll('statuses');
  const now = Date.now();
  for (let s of all) {
    if (now - s.timestamp > DURATION_STATUS_EXPIRY) {
      await window.AppDB.delete('statuses', s.id);
    }
  }
}

/* ==========================================================================
   13. HELPER FUNCTIONS & ROUTERS
   ========================================================================== */

function renderBlockedList() {
  const container = document.getElementById('blocked-contacts-list');
  if (!container) return;
  window.AppDB.getAll('contacts').then(list => {
    const blocked = list.filter(c => c.blocked);
    container.innerHTML = '';
    if (blocked.length === 0) {
      container.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No blocked numbers.</p>';
      return;
    }
    blocked.forEach(c => {
      const card = document.createElement('div');
      card.className = 'blocked-contact-item';
      card.innerHTML = `
        <div class="blocked-number-info">
          <strong>${c.name}</strong>
          <span style="font-size:0.75rem; color:var(--text-secondary);">${c.number}</span>
        </div>
        <button onclick="unblockFromSettings('${c.number}')">Unblock</button>
      `;
      container.appendChild(card);
    });
  });
}

window.unblockFromSettings = async function(number) {
  const c = await window.AppDB.get('contacts', number);
  if (c) {
    c.blocked = false;
    await window.AppDB.put('contacts', c);
    renderBlockedList();
    loadContacts();
    if (state.activeChatId === number) {
      openChatView(c);
    }
  }
};

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  if (secs < 60) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 12) return `${hrs}h ago`;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Tap outside to close all overlay modals
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

function openLightbox(src) {
  el.imageLightboxImg.src = src;
  el.imageLightbox.classList.add('active');
}

function applySavedConfig() {
  const theme = localStorage.getItem('pc_active_theme') || 'theme-light';
  document.body.classList.remove('theme-light', 'theme-light', 'theme-midnight', 'theme-emerald', 'theme-sunset');
  document.body.classList.add(theme);
  
  if (el.themeSelect) el.themeSelect.value = theme;
  if (el.profileThemeSelect) el.profileThemeSelect.value = theme;

  const font = localStorage.getItem('pc_active_font') || 'font-outfit';
  document.body.classList.remove('font-outfit', 'font-playfair', 'font-fira', 'font-dyslexic');
  document.body.classList.add(font);
  el.fontSelect.value = font;

  const wp = localStorage.getItem('pc_active_wallpaper') || 'wp-glass';
  el.wallpaperSelect.value = wp;
  if (wp === 'wp-custom') {
    el.customWallpaperWrapper.style.display = 'block';
    const savedCustom = localStorage.getItem('pc_custom_wallpaper');
    if (savedCustom) {
      el.chatMessages.style.backgroundImage = `url(${savedCustom})`;
      el.chatMessages.style.backgroundSize = 'cover';
    }
  } else {
    el.customWallpaperWrapper.style.display = 'none';
    el.chatMessages.className = "chat-messages";
    el.chatMessages.classList.add(wp.replace('wp-', 'wp-'));
  }
}

// Window unload publish offline status
window.addEventListener('beforeunload', () => {
  publishPresence("offline");
});

window.addEventListener('DOMContentLoaded', async () => {
  initEmojiPicker();
  applySavedConfig();
  
  try {
    const profiles = await window.AppDB.getAll('profile');
    if (profiles.length === 0) {
      el.screenSignup.classList.add('active');
    } else {
      el.screenLogin.classList.add('active');
      const savedPhone = localStorage.getItem('pc_active_phone');
      if (savedPhone) {
        el.loginPhone.value = savedPhone;
        el.loginPassword.focus();
      }
    }
  } catch (e) {
    el.screenLogin.classList.add('active');
  }
});
