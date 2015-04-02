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
  document.getElementById('toggleConsumablesViewLink').innerHTML = 'Show Consumables';
}

//creates a list of all saved links
//may need to add pages to support lots of links
function showLinks() {
  chrome.storage.local.get('user', function(c) {
    if(!c.user) { return; }
    var user = c.user;
    var linkList;
    linkList= '<ul>';
    //console.log(data);
    for (var i in user._consumptions) {
      var consumption = user._consumptions[i];
      linkList += '<li id="'+consumption._id+'" data-url="'+consumption._consumable.url+'" class="consumption">'+consumption._consumable.url
                + '<br>'+(consumption.consumeTime/1000)+'s</li>';
    }
    linkList += '</ul>';
    //console.log(linkList);
    document.getElementById('consumablesDiv').innerHTML = linkList;
    //set listeners to links (for custom tab opening)
    //replicates an <a> with some more js added
    for(var i in user._consumptions) {
      var consumption = user._consumptions[i];
      //console.log(consumption._consumable.url);
      // document.getElementById(consumption._id).addEventListener('click', beginConsumption(consumption._consumable.url));
    }
    document.getElementById('toggleConsumablesViewLink').innerHTML = 'Hide Consumables';

  });
}


function logoutUser(e) {
  $.ajaxSetup({headers: {}});
  document.getElementById('loginLogoutDiv').innerHTML = '<span id="loginLogoutLink">Login</span>';
  document.getElementById('loginLogoutLink').addEventListener('click', loginUser);
  clearConsumables();

  chrome.storage.local.remove('user');
  updateActionItems();
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

// add credentials to all ajax calls
function login() {
  var username = $('#username').val();
  var password = $('#password').val();
  console.log('beginning login');

  $.ajaxSetup({
    headers: { 'Authorization': 'Basic '+btoa(username+':'+password) },
  });

  // required for prod - not just a test
  testLogin();
}

function testLogin() {
  console.log('testing login');
  $.ajax({
    method: 'get',
    // needs to be changed somehow to change depending on email and pw (since uid is unknown at this state) -Cory
    // I created an endpoint, /me, that uses the user info which is sent with every request -Calvin
    url: restServer+'me',
    success: function(responseData, textStatus, jqXHR) {
      console.log('login success');

      chrome.storage.local.get('user', function(c) {
        if (!c) {
          c = {};
        }
        c.user = responseData.user;
        chrome.storage.local.set(c);//update the storage
        updateActionItems();
      });
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log(errorThrown);
      logoutUser();
    }
  });
}

//Also need to login to user specific page
// function loginToUser(user, pass) {
//   chrome.storage.local.get('user', function(c){
//     $.ajaxSetup({
//       headers: { 'Authorization': 'Basic '+btoa(username+':'+password) },
//     });
//     $.ajax({
//       method: 'get',
//       url: restServer+'users/'+c.user.uid,
//       success: function(data, textStatus, jqXHR) {
//         console.log('logged into user page');
//       },
//       error: function(jqXHR, textStatus, errorThrown) {
//         console.log(errorThrown);
//       }
//     });
//   });
// }

function logoutUser(e) {
  $.ajaxSetup({headers: {}});
  document.getElementById('loginLogoutDiv').innerHTML = '<span id="loginLink">Login</span>';
  document.getElementById('loginLink').addEventListener('click', loginUser);
  clearConsumables();
}

// create login form
function loginUser(e) {
  var loginForm = '<input id="username" type="text" name="username" placeholder="Username">';
  loginForm += '<input id="password" type="password" name="password" placeholder="Password">';
  loginForm += '<button id="loginBtn">Login</button>';
  document.getElementById('loginLogoutDiv').innerHTML += loginForm;
  document.getElementById('loginBtn').addEventListener('click', login);
  var loginLink = document.getElementById('loginLink');
  loginLink.removeEventListener('click', loginUser);
  loginLink.addEventListener('click', closeLogin);
}

function closeLogin(e) {
  var loginLogoutDiv = document.getElementById('loginLogoutDiv');
  loginLogoutDiv.innerHTML = '<div id="loginLogoutDiv"><span id="loginLogoutLink">Login</span></div>';

  var loginLogoutLink = document.getElementById('loginLogoutLink');
  loginLogoutLink.removeEventListener('click', closeLogin);
  loginLogoutLink.addEventListener('click', loginUser);
}

//can't have a function that references an external variable so need to make one
function beginConsumption(e) {
  var self = this;
  // use this to update with later
  chrome.storage.local.set({'currentConsumption': self.attributes.id.value});
  link = 'http://' + $(self).data('url');//links no longer come with a full url

  chrome.tabs.create({ url: link }, function(tab) {
    chrome.runtime.sendMessage({tab: tab});
  });
}

function getActiveTabs(cb) {
  chrome.runtime.sendMessage({getActive: true}, function(tabs){
    cb(tabs);
  });
}

function clearConsumables() {
  chrome.storage.local.clear();
}

function stripFragment(url) {
  return url.split('#')[0];
}

//gets the url of the current tab and saves the link
function saveLinks(e) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
      //console.log('Saved: ' + tabs[0].url);
      saveLink(tabs[0].url, window.close);
  });
}

function saveLink(url, cb) {
  url = stripFragment(url);
  url = url.replace(/.*?:\/\//g, "");

  chrome.storage.local.get('user', function(c) {
    if(!c.user) {
      cb();//no user, don't save
      return;
    }
    //console.log(restServer+'users/'+c.user.uid);
    $.ajax({
      method: 'get',
      url: restServer+'consumables',
      success: function(data, textStatus, jqXHR) {
        if(!findUrl(url, data.consumables)) { //if url is not already in consumables
          $.ajax({
            url: restServer+'consumables/',
            method: 'post',
            dataType: 'json',
            data: {
              consumable: {
                url: url
              }
            },
            success: function(data2, textStatus, jqXHR) {
              addConsumable(data2.consumable._id, cb);
            }
          });
        }
        else {
          var cid = data.consumables[findUrl(url, data.consumables)]._id;
          addConsumable(cid, cb);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('error: '+errorThrown);
      },
      complete: function(jqXHR, textStatus) {
        console.log('complete: '+textStatus);
      }
    });
  });
}

function addConsumable(cid, cb) {
  $.ajax({
    url: restServer+'consumptions/',
    method: 'post',
    dataType: 'json',
    data: {
      consumption: {
        _consumable: cid
      }
    },
    success: function(data, textStatus, jqXHR) {
      cb();
      testLogin();
    }
  });
}

function findUrl(url, consumables) {
  url = url.replace(/.*?:\/\//g, "");
  for(var i in consumables) {
    if(consumables[i].url === url)
      return i;
  }
  return false;
}

function containsTab(tab, tabs) {
  for(var i in tabs) {
    if(tabs[i].id === tab.id)
      return i;
  }
  return false;
}

function updateActionItems() {
  chrome.storage.local.get('user', function(c) {
    var user = c.user;
    chrome.tabs.query({currentWindow: true, active: true}, function(currentTab){
        currentTab = currentTab[0];//only 1 active tab, but still array for some reason
        getActiveTabs(function(tabs) {

          document.getElementById('main').innerHTML = '';

          if (user) { //if logged in

            //////////// Consume later / Done consuming
            if (containsTab(currentTab, tabs)) { //if current tab is already a consumable
              document.getElementById('main').innerHTML += '<div class="popupItem" id="consumeDiv"><span id="consumeLink">Done consuming</span></div>';
            }
            else {
              document.getElementById('main').innerHTML += '<div class="popupItem"><span id="saveLink">Consume this page later</span></div>';
            }

            //////////// Show Consumables btn
            document.getElementById('main').innerHTML += '<div class="popupItem"><span id="toggleConsumablesViewLink">Show Consumables</span></div>';
            document.getElementById('main').innerHTML += '<div id="consumablesDiv"></div>';

            //////////// Logout btn
            document.getElementById('main').innerHTML += '<div class="popupItem" id="loginLogoutDiv"><span id="loginLogoutLink">Logout</span></div>';
            document.getElementById('loginLogoutLink').addEventListener('click', logoutUser);
          }
          else {
            //////////// Login btn
            document.getElementById('main').innerHTML += '<div class="popupItem" id="loginLogoutDiv"><span id="loginLogoutLink">Login</span></div>';
            document.getElementById('loginLogoutLink').addEventListener('click', loginUser);
          }
      });
    });
  });
}

//very messy because listeners must be added after page is modified
document.addEventListener('DOMContentLoaded', function () {
  updateActionItems();
  $('#main').on('click', '#toggleConsumablesViewLink', toggleConsumablesViewLink);
  $('#main').on('click', '#saveLink', saveLinks);
  $('#main').on('click', '#consumeLink', consumeLink);
  $('#main').on('click', '.consumption', beginConsumption);
});

function consumeLink(e) {
  chrome.tabs.query({ currentWindow: true, active: true }, function(currentTab) {
    currentTab = currentTab[0];
    chrome.runtime.sendMessage({getTime: currentTab.url}, function(timex) {
      chrome.storage.local.get('currentConsumption', function(c) {
        var consumptionId = c.currentConsumption;
        $.ajax({
          method: 'put',
          url: restServer+'consumptions/'+consumptionId,
          contentType: "application/json",
          data: JSON.stringify({
              "consumption": {
                "consumeTime": time,
                "consumed": true
              }
            }),
          error: function (jqXHR, textStatus, errorThrown) {
            console.log('error: '+errorThrown);
          },
          complete: function (jqXHR, textStatus) {
            console.log('complete: '+textStatus);
            chrome.storage.local.remove('currentConsumption');
            //window.close();
          }
        });
      });
    });
  });
}
