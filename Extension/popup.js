//No state information should be stored in the popup. UI only

function toggleMyConsumablesViewLink(e) {
  var showingLinks = !!$('#toggleMyConsumablesViewLink').data('showingLinks');
  if (showingLinks) {
    hideMyLinks();
  } else {
    showMyLinks();
  }
  $('#toggleMyConsumablesViewLink').data('showingLinks', !showingLinks);
}

function hideMyLinks() {
  $('#myConsumablesDiv').html('');
  $('#toggleMyConsumablesViewLink').html('+ My Consumables');
}

//creates a list of all saved links
function showMyLinks() {
  chrome.runtime.sendMessage({
    type: 'getConsumptions'
  });
}

function toggleTopConsumablesViewLink(e) {
  var showingLinks = !!$('#toggleTopConsumablesViewLink').data('showingLinks');
  if (showingLinks) {
    hideTopLinks();
  } else {
    showTopLinks();
  }
  $('#toggleTopConsumablesViewLink').data('showingLinks', !showingLinks);
}

function hideTopLinks() {
  $('#topConsumablesDiv').html('');
  $('#toggleTopConsumablesViewLink').html('+ Top Consumables');
}

//creates a list of top links
function showTopLinks() {
  chrome.runtime.sendMessage({
    type: 'getTopConsumables'
  });
}

function logoutUser(e) {
  chrome.runtime.sendMessage({
    type: 'logout'
  })
  $('#loginLogoutDiv').html('<span id="loginLogoutLink">Login</span>');
  $('#loginLogoutLink').on('click', showLoginForm);
  updateActionItems(false);
}

// create login form
function showLoginForm(e) {
  var loginForm = '<div class="popupItem loginForm"><input id="username" type="text" name="username" placeholder="Username">';
  loginForm += '<input id="password" type="password" name="password" placeholder="Password">';
  loginForm += '<button id="loginBtn">Login</button></div>';
  $('#main').append(loginForm);
  $('#loginBtn').on('click', login);
  $('#loginLogoutLink').on('', closeLogin);
  $('#loginLogoutLink').off('', showLoginForm);
}

//Listens for message to update ui
//Sort of hacky but easier than setting up constant connection
chrome.runtime.onMessage.addListener(function(msg, sender, cb){
  if(msg.type === 'update'){
    updateActionItems(true);
  }
  //used to be in show links
  else if(msg.type === 'consumptions'){
    var consumptions = msg.response.user._consumptions;
    var linkList = '<ul>';
    //set listeners to links (for custom tab opening)
    //replicates an <a> with some more js added
    for (var i in consumptions) {
      linkList += '<li id="' + consumptions[i]._id + '" ';
      linkList += generateConsumableListItem(consumptions[i]._consumable);
    }
    linkList += '</ul>';
    $('#myConsumablesDiv').html(linkList);
    $('#toggleMyConsumablesViewLink').html('- My Consumables');
  }
  else if (msg.type === 'topConsumables') {
    var consumables = msg.response.consumables;
    var linkList = '<ul>';
    for (var i in consumables) {
      linkList += '<li ';
      linkList += generateConsumableListItem(consumables[i]);
    }
    linkList += '</ul>';
    $('#topConsumablesDiv').html(linkList);
    $('#toggleTopConsumablesViewLink').html('- Top Consumables');
  }
});

function generateConsumableListItem(consumable) {
  listItem = 'data-url="' + consumable.url + '" class="consumption">' + consumable.url + '<br>';
  if (consumable.consumedCount && consumable.consumedCount > 0) {
    listItem += 'Average Consume Time: ' + (consumable.averageConsumeTime / 1000) + 's<br>';
    listItem += 'Consumed: ' + (consumable.consumedCount) + ' time' + (consumable.consumedCount == 1 ? '' : 's');
  } else {
    listItem += '<strong>Be the first to consume this! </strong>';
  }
  return listItem += '</li>';
}

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
  $('#loginLogoutLink').on('', showLoginForm);
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
          // $('#main').append('<div class="popupItem clickable" id="consumeLink" id="consumeLink">Done consuming</div>');
          $('#consumeLink').show();
          $('#consumeLink').text('Done Consuming');
          $('#titleDiv').on('click', '#consumeLink', consumeLink);
          $('#saveLink').hide();
        } else {
          // $('#main').append('<div class="popupItem clickable" id="saveLink">Add Current Page</div>');
          $('#saveLink').show();
          $('#saveLink').text('Add Current Page');
          $('#titleDiv').on('click', '#saveLink', saveLinks);
          $('#consumeLink').hide();
        }
      }

      $('#main').append('<div class="popupItem clickable" id="toggleTopConsumablesViewLink">+  Top Consumables</div>');
      $('#main').append('<div id="topConsumablesDiv" class="consumableList"></div>');
      $('#main').on('click', '#toggleTopConsumablesViewLink', toggleTopConsumablesViewLink);

      if (userState) {
        //////////// Show My Consumables btn
        $('#main').append('<div class="popupItem clickable" id="toggleMyConsumablesViewLink">+  My Consumables</div>');
        $('#main').append('<div id="myConsumablesDiv" class="consumableList"></div>');
        $('#main').on('click', '#toggleMyConsumablesViewLink', toggleMyConsumablesViewLink);
      }

      if (userState) {
        //////////// Logout btn
        // $('#main').append('<div class="popupItem" id="loginLogoutDiv"><span id="loginLogoutLink">Logout</span></div>');
        $('#loginLogoutDiv').text('Logout');
        $('#loginLogoutDiv').on('click', logoutUser);
      }
      else {
        //////////// Login btn
        // $('#main').append('<div class="popupItem" id="loginLogoutDiv"><span id="loginLogoutLink">Login</span></div>');
        $('#loginLogoutDiv').text('Login');
        $('#loginLogoutDiv').on('click', showLoginForm);
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

function consumeLink(e) {
  console.log('done consuming')
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

//very messy because listeners must be added after page is modified
document.addEventListener('DOMContentLoaded', function() {
  checkState();
  $('#main').on('click', '.consumption', beginConsumption);
});
