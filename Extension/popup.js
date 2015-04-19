var restServer = 'https://consumit-rest-nodejs.herokuapp.com/api/';

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
  document.getElementById('consumablesDiv').innerHTML = '';
  document.getElementById('toggleConsumablesViewLink').innerHTML = 'Show My Consumables';
}

//creates a list of all saved links
//may need to add pages to support lots of links
function showLinks() {
  chrome.storage.local.get('user', function(c) {
    if (!c.user) {
      return;
    }
    
    //console.log(c);

    var user = c.user;
    var linkList;
    linkList = '<ul>';

    for (var i in user._consumptions) {
      var consumption = user._consumptions[i];
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

    document.getElementById('consumablesDiv').innerHTML = linkList;

    //set listeners to links (for custom tab opening)
    //replicates an <a> with some more js added
    for (var i in user._consumptions) {
      var consumption = user._consumptions[i];
    }

    document.getElementById('toggleConsumablesViewLink').innerHTML = 'Hide Consumables';

  });
}


function logoutUser(e) {
  chrome.runtime.sendMessage({
    logout: true
  }, function(){
    document.getElementById('loginLogoutDiv').innerHTML = '<span id="loginLogoutLink">Login</span>';
    document.getElementById('loginLogoutLink').addEventListener('click', loginUser);
    updateActionItems();
  });
}

// create login form
function loginUser(e) {
  var loginForm = '<br><input id="username" type="text" name="username" placeholder="Username"><br>';
  loginForm += '<input id="password" type="password" name="password" placeholder="Password"><br>';
  loginForm += '<button id="loginBtn">Login</button>';
  document.getElementById('loginLogoutDiv').innerHTML += loginForm;
  document.getElementById('loginBtn').addEventListener('click', login);
  var loginLogoutLink = document.getElementById('loginLogoutLink');
  loginLogoutLink.removeEventListener('click', loginUser);
  loginLogoutLink.addEventListener('click', closeLogin);
}

//Listens for message to update ui
//Sort of hacky but easier than setting up constant connection
chrome.runtime.onMessage.addListener(function(msg, sender, cb){
  if(msg.update){
    updateActionItems();
  }
  if(msg.logout){
    logoutUser();
  }
  if(msg.close){
    window.close();
  }
});

// add credentials to all ajax calls
function login() {
  var username = $('#username').val();
  var password = $('#password').val();
  
  chrome.runtime.sendMessage({
    login: true,
    user: username,
    pass: password
  });
}

function closeLogin(e) {
  var loginLogoutDiv = document.getElementById('loginLogoutDiv');
  loginLogoutDiv.innerHTML = '<div id="loginLogoutDiv"><span id="loginLogoutLink">Login</span></div>';

  var loginLogoutLink = document.getElementById('loginLogoutLink');
  loginLogoutLink.removeEventListener('click', closeLogin);
  loginLogoutLink.addEventListener('click', loginUser);
}

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
      tab: tab
    });
  });
}

function getActiveTabs(cb) {
  chrome.runtime.sendMessage({
    getActive: true
  }, function(tabs) {
    cb(tabs);
  });
}

function stripFragment(url) {
  return url.split('#')[0];
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

function saveLink(url, cb) {
  url = stripFragment(url);
  url = url.replace(/.*?:\/\//g, "");
  chrome.runtime.sendMessage({
    link: url
  });
}

function containsTab(tab, tabs) {
  for (var i in tabs) {
    if (tabs[i].id === tab.id)
      return i;
  }
  return false;
}

function updateActionItems() {
  chrome.storage.local.get('user', function(c) {
    var user = c.user;
    chrome.tabs.query({
      currentWindow: true,
      active: true
    }, function(currentTab) {
      currentTab = currentTab[0]; //only 1 active tab, but still array for some reason
      getActiveTabs(function(tabs) {

        document.getElementById('main').innerHTML = '';

        if (user) { //if logged in

          //////////// Consume later / Done consuming
          if (containsTab(currentTab, tabs)) { //if current tab is already a consumable
            document.getElementById('main').innerHTML += '<div class="popupItem" id="consumeDiv"><span id="consumeLink">Done consuming</span></div>';
          } else {
            document.getElementById('main').innerHTML += '<div class="popupItem"><span id="saveLink">Consume this page later</span></div>';
          }

          //////////// Show Consumables btn
          document.getElementById('main').innerHTML += '<div class="popupItem"><span id="toggleConsumablesViewLink">Show My Consumables</span></div>';
          document.getElementById('main').innerHTML += '<div id="consumablesDiv"></div>';

          //////////// Logout btn
          document.getElementById('main').innerHTML += '<div class="popupItem" id="loginLogoutDiv"><span id="loginLogoutLink">Logout</span></div>';
          document.getElementById('loginLogoutLink').addEventListener('click', logoutUser);
        } else {
          //////////// Login btn
          document.getElementById('main').innerHTML += '<div class="popupItem" id="loginLogoutDiv"><span id="loginLogoutLink">Login</span></div>';
          document.getElementById('loginLogoutLink').addEventListener('click', loginUser);
        }
      });
    });
  });
}

//very messy because listeners must be added after page is modified
document.addEventListener('DOMContentLoaded', function() {
  updateActionItems();
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
      getTime: currentTab.url
    }, function(time) {
      chrome.storage.local.get('currentConsumption', function(c) {
        var consumptionId = c.currentConsumption;
        chrome.runtime.sendMessage({
          consume: true,
          time: time,
          cid: consumptionId
        });
      });
    });
  });
}
