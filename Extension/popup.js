//No state information should be stored in the popup. UI only

function toggleConsumablesViewLink(e) {
  var showingLinks = !!$('#toggleConsumablesViewLink').data('showingLinks');
  if (showingLinks) {
    hideLinks();
  } else {
    showLinks();
  }
  $('#toggleConsumablesViewLink').data('showingLinks', !showingLinks);
}

function hideLinks() {
  $('#consumablesDiv').html('');
  $('#toggleConsumablesViewLink').html('Show My Consumables');
}

//creates a list of all saved links
function showLinks() {
  chrome.runtime.sendMessage({
    type: 'getConsumptions'
  });
}

function logoutUser(e) {
  chrome.runtime.sendMessage({
    type: 'logout'
  })
  $('#loginLogoutDiv').html('<span id="loginLogoutLink">Login</span>');
  $('#loginLogoutLink').on('click', loginUser);
  updateActionItems(false);
}

// create login form
function loginUser(e) {
  var loginForm = '<br><input id="username" type="text" name="username" placeholder="Username"><br>';
  loginForm += '<input id="password" type="password" name="password" placeholder="Password"><br>';
  loginForm += '<button id="loginBtn">Login</button>';
  $('#loginLogoutDiv').append(loginForm);
  $('#loginBtn').on('click', login);
  $('#loginLogoutLink').on('', closeLogin);
  $('#loginLogoutLink').off('', loginUser);
}

//Listens for message to update ui
//Sort of hacky but easier than setting up constant connection
chrome.runtime.onMessage.addListener(function(msg, sender, cb){
  if(msg.type === 'update'){
    updateActionItems(true);
  }
  //used to be in show links
  if(msg.type === 'consumptions'){
    var consumptions = msg.response.user._consumptions;
    var linkList = '<ul>';
    //set listeners to links (for custom tab opening)
    //replicates an <a> with some more js added
    for (var i in consumptions) {
      var consumption = consumptions[i];
      var consumable = consumption._consumable;
      linkList += '<li id="' + consumption._id + '" data-url="' + consumable.url + '" class="consumption">' + consumable.url + '<br>';
      if (consumable.consumedCount && consumable.consumedCount > 0) {
        linkList += 'Average Consume Time: ' + (consumable.averageConsumeTime / 1000) + 's<br>';
        linkList += 'Consumed: ' + (consumable.consumedCount) + ' time' + (consumable.consumedCount == 1 ? '' : 's');
      } else {
        linkList += '<strong>Be the first to consume this! </strong>';
      }
      linkList += '</li>';
    }
    linkList += '</ul>';
    $('#consumablesDiv').html(linkList);
    $('#toggleConsumablesViewLink').html('Hide Consumables');
  }
});

// add credentials to all ajax calls
function login() {
  var username = $('#username').val();
  var password = $('#password').val();
  
  chrome.runtime.sendMessage({
    type: 'login',
    user: username,
    pass: password
  });
}

function closeLogin(e) {
  $('#loginLogoutDiv').html('<div id="loginLogoutDiv"><span id="loginLogoutLink">Login</span></div>');

  $('#loginLogoutLink').off('', closeLogin);
  $('#loginLogoutLink').on('', loginUser);
}

//TODO: figure this out
function beginConsumption(e) {
  var self = this;
  // use this to update with later
  chrome.storage.local.set({
    'currentConsumption': self.attributes.id.value
  });
  link = 'http://' + $(self).data('url'); //links no longer come with a full url

  chrome.tabs.create({
    url: link
  }, function(tab) {
    chrome.runtime.sendMessage({
      type: 'startTimer',
      tab: tab
    });
  });
}

//gets the url of the current tab and saves the link
function saveLinks(e) {
  chrome.tabs.query({
    currentWindow: true,
    active: true
  }, function(tabs) {
    //console.log('Saved: ' + tabs[0].url);
    saveLink(tabs[0].url);
  });
}

function saveLink(url) {
  chrome.runtime.sendMessage({
    type: 'saveLink',
    url: url
  });
}

function containsTab(tab, trackedTabs) {
  return (trackedTabs.indexOf(tab.id) !== -1);
}

//userState is login/logout status
function updateActionItems(userState) {
  chrome.tabs.query({
    currentWindow: true,
    active: true
  }, function(currentTab) {
    currentTab = currentTab[0]; //only 1 active tab, but still array for some reason
    chrome.runtime.sendMessage({
      type: 'getActiveTabs'
    }, function(tabs) {
      $('#main').html('');
      if (userState) { //if logged in
        //////////// Consume later / Done consuming
        if (containsTab(currentTab, tabs)) { //if current tab is already a consumable
          $('#main').append('<div class="popupItem" id="consumeDiv"><span id="consumeLink">Done consuming</span></div>');
        } else {
          $('#main').append('<div class="popupItem"><span id="saveLink">Consume this page later</span></div>');
        }

        //////////// Show Consumables btn
        $('#main').append('<div class="popupItem"><span id="toggleConsumablesViewLink">Show My Consumables</span></div>');
        $('#main').append('<div id="consumablesDiv"></div>');

        //////////// Logout btn
        $('#main').append('<div class="popupItem" id="loginLogoutDiv"><span id="loginLogoutLink">Logout</span></div>');
        $('#loginLogoutLink').on('click', logoutUser);
      }
      else {
        //////////// Login btn
        $('#main').append('<div class="popupItem" id="loginLogoutDiv"><span id="loginLogoutLink">Login</span></div>');
        $('#loginLogoutLink').on('click', loginUser);
      }
    });
  });
}

//Change ui after checking state
function checkState(){
  chrome.runtime.sendMessage({
    type: 'checkState'
  }, updateActionItems);
}

//very messy because listeners must be added after page is modified
document.addEventListener('DOMContentLoaded', function() {
  checkState();
  $('#main').on('click', '#toggleConsumablesViewLink', toggleConsumablesViewLink);
  $('#main').on('click', '#saveLink', saveLinks);
  $('#main').on('click', '#consumeLink', consumeLink);
  $('#main').on('click', '.consumption', beginConsumption);
});

function consumeLink(e) {
  chrome.tabs.query({
    currentWindow: true,
    active: true
  }, function(currentTab) {
    currentTab = currentTab[0];
    chrome.runtime.sendMessage({
      type: 'consumeLink',
      url: currentTab.url
    });
  });
}
