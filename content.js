// Christina Aiello, 2021

/*
* At a high level, this Chrome Extension checks if we are on 
* the MA Immunizations Website, checks if the user has given
* this browser tab permissions to make sounds yet, and if they
* have, checks every few seconds to see if the current page is
* the signup page rather than the lobby page.
*
*
* The Nitty Gritty:
* If we are on the MA Immunizations Website, this extension
* checks to see if the user has seen the welcome message for this
* Chrome extension before. If they have already seen it, we don't 
* show it. If they have not seen it yet, we show it.
*
* This extension then sees if, during this browser session, the user
* has given us permissions to play sounds. Sound permission must be 
* given via clicking anywhere on the page. If they have not yet given 
* us sound permission, we will try to play the test sound (which will 
* alert them to click on something to give us sound permissions).
* If during this session they HAVE triggered the test sound already,
* meaning we have been given sound permissions, we just immediately
* start the interval to check over and over if we are on the test page.
* The `hasSuccessfullyTriggeredTestSound` is cleared once the browser
* closes, but it persists between refreshes (which is necessary because
* the MA Immunizations Website refreshes itself over and over.)
*
* Once we know we have permission to make sounds, this extension
* repeatedly checks to see if the page is currently displaying
* the sign up functionality. If it is, it rings and pops an alert modal.
*/
function setUpAlerting() {
    var currentPage = window.location.toString();
    if (currentPage.includes("www.maimmunizations.org")) {
        log(`We are on vaccination website: ${currentPage}`);

        // Only show welcome message once
        chrome.storage.sync.get(['hasSeenWelcomeMessage'], function(result) {
            var hasSeenWelcomeMessage = result["hasSeenWelcomeMessage"];
            log(`hasSeenWelcomeMessage value is currently: ${hasSeenWelcomeMessage}`);
            if (!hasSeenWelcomeMessage) {
                alert("For this extension to be allowed to make noise, Google Chrome requires you to interact with the page before it can produce sounds.\n\nPlease click anywhere on the page. It doesn't need to be a link – you can click on any text, image, or blank white space on the page. Doing this will tell Chrome you allow sound.\n\nYou will hear a test ringing noise first, to confirm you have allowed sound.");
                // Save to local storage the fact that we've successfully seen the intro message, 
                // which is needed because the page refreshes itself...
                chrome.runtime.sendMessage({valueToSet: "hasSeenWelcomeMessage"}, function(response) {
                    log(response.response);
                });
            }

            // Test sound must be triggered every time this window is open, since Chrome sets
            // the sound permissions on a page per browser session. This should persist
            // through refreshes of the page, and it clears when the browser closes.
            var hasSuccessfullyTriggeredTestSound = sessionStorage.getItem('hasSuccessfullyTriggeredTestSound');
            log(`hasSuccessfullyTriggeredTestSound is: ${hasSuccessfullyTriggeredTestSound}`);
            // Only trigger test noise once
            if (!hasSuccessfullyTriggeredTestSound) {
                // Test sound
                setTimeout(function() {  
                    playTestSound();
                }, 5000);
            } else {
                setUpIntervalToCheckForSignupPage();
            }
        });
    } else {
        log("We are not on the MA Immunizations Website.");
    }
}

// This is in its own function because we need to call it 
// 1) When the page reloads, and the page auto-reloads right now
// and 2) Once we've run the test sound and confirmed that the user
// has given us permissions to ring on the page.
function setUpIntervalToCheckForSignupPage() {
    var timer = setInterval(function() {  
        lookForSignup(timer);
    }, 3000);
}

// Checks the page to see if this is the signup page.
// @param timer: The timer object that we will cancel once we've rung
function lookForSignup(timer) {
    var textToLookFor1 = "Search by".toLowerCase();
    var textToLookFor2 = "ONLY by prioritized individuals".toLowerCase();
    var now = new Date().toLocaleString();
    log(`Checking if this is the signup page at ${now}`);
    var elements = document.getElementsByTagName('*');
    for (var i = 0; i < elements.length; i++)
    {
        var element = elements[i];
        for (var j = 0; j < element.childNodes.length; j++)
        {
            var node = element.childNodes[j];
            if (node.nodeType === Node.TEXT_NODE)
            {
                var text = node.nodeValue.toLowerCase();
                if ((text.includes(textToLookFor1)) || (text.includes(textToLookFor2))) {
                    // As soon as we find the right text, 
                    // ring and then stop searching the page
                    ring();
                    clearInterval(timer);
                    return;
                }
            }
        }
    }
}

// Plays a test sound for the user, to let them know what to expect.
// If it can successfully play the test sound, it plays the sound and
// starts up the interval at which we check to see if we're on the
// sign up page. If it CANNOT play the test sound, it alerts the user
// and tries again to play the test sound.
// Sound requirement info: https://goo.gl/xX8pDD
function playTestSound() {
    var audio = new Audio(chrome.runtime.getURL("sounds/test-ring.mp3"));
    log("Test ring!");
    audio.play().then(function () {
        // If they've enabled sound, set up the interval to check the page over and over
        alert("This is your test sound! This means you have allowed sound. The page will now ring 5 times when it's your turn to sign up for the vaccine.");
        // Save to session storage the fact that we've successfully triggered 
        // test sound, which is needed because the page refreshes itself...
        window.sessionStorage.setItem("hasSuccessfullyTriggeredTestSound", true);
        // Prep the real ring (and the process to check if we are on the signup page), 
        // now that we have sound permissions in this browser session
        setUpIntervalToCheckForSignupPage();
    }).catch(function(error) {
        // Else do test sound again
        alert("If you're seeing this, that means you still need to click somewhere on the page to let this extension make sound.\n\nChrome requires that each time you start a new Chrome session, you have to interact with a page before an extension that runs on that page can produce sound.\n\nPlease click anywhere, even on blank white space!");
        setTimeout(function() {  
            playTestSound();
        }, 2000);
    });
}

// Rings for the user, so they know it's their turn.
function ring() {
    var audio = new Audio(chrome.runtime.getURL("sounds/ring.mp3"));
    log("It's your turn to sign up!");
    audio.play().catch(function(error) {
        // If somehow we lost sound permissions, alert them to let them know.
        playTestSound();
    });
}

function log(message) {
    console.log(`[MA COVID Vaccine Signup Ringer][${new Date().toLocaleString()}] ${message}`);
}

// Called upon each page load
setUpAlerting();