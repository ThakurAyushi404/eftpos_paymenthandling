const baseURL1 = process.env.BASE_URL_1;
const baseURL2 = process.env.BASE_URL_2;
const baseURL3 = process.env.BASE_URL_3;
const restaurantId = process.env.RESTAURANT_ID;
const kioskGuid = process.env.KIOSK_GUID;
const key = process.env.AUTH_KEY;

createDonation(20.00); // creates donation for $20

function createDonation(totalPay) {
  
    const customerName = document.getElementById("name")?.value.trim() || null;
    const customerMobile = document.getElementById("mobile")?.value.trim() || null;
    const activeButton = document.querySelector('.donation-btn.active');
    const buttonId = activeButton?.getAttribute('data-id') || 0;

    let description = "Donation";
    const modal = document.getElementById("donationModal");
    const isFromSubitems = modal.getAttribute("data-from-subitems") === "true";

    if (isFromSubitems) {
        // Use the parent description stored in the modal
        description = modal.getAttribute("data-description") || "Donation";
    } else if (activeButton) {
        // Use the button's description
        description = activeButton.getAttribute("data-description") || "Donation";
    }

    
    const messageElement = document.getElementById("donationMessage");
    if (messageElement && messageElement.textContent.trim() &&
        !messageElement.textContent.includes("You are donating")) {
        description = messageElement.textContent.trim();
    }

    const donationData = {
        donationAmount: parseFloat(totalPay),
        restaurant_ID: restaurantId,
        detail_ID: parseInt(buttonId),
        donationDesc: description,
        donation_ID: globalDonationId || "00000000-0000-0000-0000-000000000000",
        donationCustomer: {
            customerID: "00000000-0000-0000-0000-000000000000",
            customerName: customerName,
            customerAddress: null,
            customerMobile: customerMobile
        }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    fetch(`${baseURL1}/CreateDonation`, {
        method: "POST",
        headers: {
            'Authorization': `Basic ${key}`,
            'X-Type': 'KIOSK',
            "Content-Type": "application/json"
        },
        body: JSON.stringify(donationData),
        signal: controller.signal
    })
        .then(response => {
            clearTimeout(timeoutId);
            if (response.status === 401) {
                logout();
                throw new Error("Unauthorized: Redirecting to login");
            }
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {


            if (data?.donation_ID) {
                globalDonationId = data.donation_ID;
                previousDonationAmount = parseFloat(totalPay);


                processDonationPayment(totalPay);
            } else {
                throw new Error("Invalid donation ID received.");
            }
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.error("CreateDonation request timed out.");
            } else {
                console.error("Error creating donation:", error);
            }
            showErrorPopup("Failed to create donation. Please try again.");
        });
}



function processDonationPayment(totalPay) {

    const amount = totalPay || previousDonationAmount || 0;
    const activeButton = document.querySelector('.donation-btn.active');
    const buttonId = activeButton?.getAttribute('data-id') || 0;

    let description = "Donation";
    const modal = document.getElementById("donationModal");
    const isFromSubitems = modal.getAttribute("data-from-subitems") === "true";

    if (isFromSubitems) {
        // Use the parent description stored in the modal
        description = modal.getAttribute("data-description") || "Donation";
    } else if (activeButton) {
        // Use the button's description
        description = activeButton.getAttribute("data-description") || "Donation";
    }

    // If there's a custom message in the message element, use that instead
    const messageElement = document.getElementById("donationMessage");
    if (messageElement && messageElement.textContent.trim() &&
        !messageElement.textContent.includes("You are donating")) {
        description = messageElement.textContent.trim();
    }

    stopInactivityTracking();
    resetModal();

    const donationData = {
        donationAmount: parseFloat(amount),
        restaurant_ID: restaurantId,
        donation_ID: globalDonationId,
        detail_ID: parseInt(buttonId),
        donationDesc: description,
        donationCustomer: null
    };
    paymentInProgress = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    fetch(`${baseURL1}/MakeDonationPayment`, {
        method: "POST",
        headers: {
            'Authorization': `Basic ${key}`,
            'X-Type': 'KIOSK',
            "Content-Type": "application/json"
        },
        body: JSON.stringify(donationData),
        signal: controller.signal
    })
        .then(response => {
            clearTimeout(timeoutId);
            if (response.status === 401) {
                logout();
                throw new Error("Unauthorized: Redirecting to login");
            }
            return response.json();
        })
        .then(async (data) => {


            donateGuid = globalDonationId;
            replaceDonationButtonsWithModal();
            $('#donationModal').modal('hide');
            updateModal(data);

            const txnRef = data.txnRef;
            window.txnRef = txnRef;

            if (data.complete !== 1 && txnRef) {
                await pollEftposStatus(txnRef);
            } else if (!txnRef) {
                showErrorState();
                startInactivityTracking();
            }
        })
        .catch(error => {
            console.error("Error:", error);
            if (error.name === 'AbortError') {
                console.error("Request timed out after 20 seconds.");
            }
            showErrorState();
            startInactivityTracking();
        })
        .finally(() => {
            resetButton();
        });
}





function updateModal(response) {
    const machineDisplay = response.machineDisplay || {};
    const line1 = machineDisplay.dL1 || "";
    const line2 = machineDisplay.dL2 || "";

    $('#line1Container').text(line1).toggle(!!line1);
    $('#line2Container').text(line2).toggle(!!line2);

    const buttons = machineDisplay.buttons || [];
    $('.eftpos-button').hide();

    if (buttons.length === 0) {
        $('#button1').hide();
        $('#button2').hide();
    } else {
        buttons.forEach(button => {
            if (button.name === "B1") {
                $('#button1').show()
                    .data('buttonId', button.id)
                    .data('buttonName', button.name)
                    .data('buttonVal', button.val)
                    .data('txnRef', response.txnRef)
                    .text(button.val);
            }
            else if (button.name === "B2") {
                $('#button2').show()
                    .data('buttonId', button.id)
                    .data('buttonName', button.name)
                    .data('buttonVal', button.val)
                    .data('txnRef', response.txnRef)
                    .text(button.val);
            }
        });
    }

    if (response.complete === 1) {

        const PaymentID = response.txnRef;
        const statusDetail = response.statusDetail || {};

        if (statusDetail.transactionApprove) {
            document.getElementById('cancelButton').style.display = 'none';
            document.getElementById('retryButton').style.display = 'none';

            generateReceipt(donateGuid);
            fetchReceiptSettings(PaymentID);
        } else {
            document.getElementById('cancelButton').style.display = 'flex';
            document.getElementById('retryButton').style.display = 'flex';
            startInactivityTracking();
        }
        window.hiddenButtons = {};
        paymentInProgress = false;
    } else {
        document.getElementById('cancelButton').style.display = 'none';
        document.getElementById('retryButton').style.display = 'none';
    }
}



async function pollEftposStatus(txnRef) {
    const paymentStartTime = Date.now();
    const PAYMENT_TIMEOUT = 120000; // Overall polling timeout
    const FETCH_TIMEOUT = 25000; // 20 seconds per request

    async function checkStatus() {

        if (Date.now() - paymentStartTime > PAYMENT_TIMEOUT) {
            showErrorInModal(
                'Connection Issue',
                'Please Check Your Internet Connection'
            );
            $('#cancelButton').show();
            $('#retryButton').show();
            paymentInProgress = false;
            return false; // Stop polling
        }

        if (!txnRef) {
            console.error('txnRef is undefined');
            return false;
        }

        const encodedTxnRef = encodeURIComponent(txnRef);
        const apiUrl = `${baseURL1}/CheckDonationEftposStatus?kioskGuid=${encodeURIComponent(kioskGuid)}&txnref=${encodedTxnRef}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${key}`,
                    'X-Type': 'KIOSK',
                    "Content-Type": "application/json"
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok || !data) {
                throw new Error('Bad or null response received');
            }


            updateModal(data);

            if (data.complete === 1) {
                console.log('Transaction complete ✅');
                return false; // Stop polling
            }

            return true; // Keep polling

        } catch (error) {
            clearTimeout(timeoutId);

            console.error('Error checking payment status:', error);

            showErrorInModal('Status Check Failed',
                error.name === 'AbortError' ?
                    'Request timed out. Please try again.' :
                    'Error checking payment status.');

            return true; // Continue polling even on error
        }
    }

    let continuePolling = true;
    while (continuePolling) {
        continuePolling = await checkStatus();
        if (continuePolling) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}


function handleButtonClick(buttonName, buttonVal, txnRef) {

    if (!txnRef) {
        console.error('txnRef is undefined');
        showErrorInModal('Error', 'Transaction reference is missing');
        return;
    }

    const kioskGuid = localStorage.getItem('kioskGuid');
    if (!kioskGuid) {
        console.error('kioskGuid is missing');
        showErrorInModal('Error', 'Kiosk GUID is missing');
        return;
    }

    const key = localStorage.getItem('key');
    if (!key) {
        console.error('Authorization key is missing');
        showErrorInModal('Error', 'Authorization credentials missing');
        return;
    }

    const $button = $(this);
    const buttonId = $button.data('buttonId') || 0;


    const requestData = {
        id: buttonId,
        name: buttonName,
        val: buttonVal
    };


    $.ajax({
        type: 'POST',
        url: `${baseURL3}/SendButtonRequest?kioskGuid=${encodeURIComponent(kioskGuid)}&txnref=${encodeURIComponent(txnRef)}`,
        data: JSON.stringify(requestData),
        contentType: 'application/json',
        timeout: 25000,
        headers: {
            'Authorization': `Basic ${key}`,
            'X-Type': 'KIOSK',
            'accept': 'application/json'
        },
        success: function (response) {
            console.log('Button action successful:', response);
            $button.hide();
            pollEftposStatus(txnRef);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.error('API Error:', jqXHR.status, jqXHR.responseText);

            let errorMsg = 'Error sending button command';
            if (jqXHR.responseJSON && jqXHR.responseJSON.title) {
                errorMsg = jqXHR.responseJSON.title;
            } else if (textStatus === 'timeout') {
                errorMsg = 'Request timed out. Please try again.';
            }

            showErrorInModal('Button Action Failed', errorMsg);
        }
    });
}

async function fetchReceiptSettings(PaymentID) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 sec timeout

    try {
        if (!baseURL2 || !kioskGuid) {
            throw new Error("baseURL2 or kioskGuid is not defined");
        }

        const url = `${baseURL2}/api/GetReceiptSettings?kioskGuid=${kioskGuid}`;
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();


        if (data?.isPrintReceipt) {
            if (typeof printReceipt === "function") {
                printReceipt(donateGuid, PaymentID, kioskGuid);
            } else {
                console.error("printReceipt function is not defined");
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error("fetchReceiptSettings request timed out");
        } else {
            console.error("Error fetching receipt settings:", error);
        }
    }
}



function printReceipt(donateGuid, PaymentID, kioskGuid) {
    const url = `${baseURL2}/api/PrintReciptDonation?donateGuid=${donateGuid}&paymentId=${PaymentID}&kioskGuid=${kioskGuid}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds

    fetch(url, {
        method: 'POST',
        headers: {
            'Accept': '*/*'
        },
        body: '',
        signal: controller.signal
    })
        .then(response => {
            clearTimeout(timeoutId);
            if (response.ok) {
                return response.text();
            }
            throw new Error(`Error: ${response.status}`);
        })
        .then(data => {
            console.log("Receipt printed successfully:");
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.error("printReceipt request timed out.");
            } else {
                console.error("Failed to print receipt:", error);
            }
        });
}


$(document).ready(function () {
    // Ensure button clicks are registered only once
    $(document).off('click', '#button1').on('click', '#button1', function () {

        const buttonName = $(this).data('buttonName');
        const buttonVal = $(this).data('buttonVal');
        handleButtonClick.call(this, buttonName, buttonVal, window.txnRef);
    });

    $(document).off('click', '#button2').on('click', '#button2', function () {

        const buttonName = $(this).data('buttonName');
        const buttonVal = $(this).data('buttonVal');
        handleButtonClick.call(this, buttonName, buttonVal, window.txnRef);
    });

    $(document).off('click', '#retryButton').on('click', '#retryButton', function () {

        if (!previousDonationAmount || previousDonationAmount <= 0) {
            showErrorPopup("Donation amount missing. Please try again.");
            return;
        }
        processDonationPayment(previousDonationAmount);
    });

    $(document).off('click', '#cancelButton').on('click', '#cancelButton', function () {
        $('#donationModal').modal('show');
        $('#windcaveModal').modal('hide');

        const currentAmount = previousDonationAmount || 0;
        validateAmountRequirements(currentAmount);

        validateAmountRequirements(previousDonationAmount);
        startInactivityTracking();
    });
});