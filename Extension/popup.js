//No state information should be stored in the popup. UI only

//creates a list of all saved links
function showMyLinks() {
  chrome.runtime.sendMessage({
    type: 'getConsumptions'
  });
}

//creates a list of top links
function showTopLinks() {
  chrome.runtime.sendMessage({
    type: 'getTopConsumables'
  });
}

function showLinks() {
  $('.tab.active').removeClass('active');
  $(this).addClass('active');
  chrome.runtime.sendMessage({
    type: $(this).data('type')
  });
}

function logoutUser(e) {
  chrome.runtime.sendMessage({
    type: 'logout'
  })
  updateActionItems(false);
}

// create login form
function showLoginForm(e) {
  var loginForm = ' \
    <div id="loginForm"> \
      <input id="username" type="text" name="username" placeholder="Username"> <br> \
      <input id="password" type="password" name="password" placeholder="Password"> <br> \
      <input id="loginBtn" type="button" value="Login"> \
    </div>';
  $('#tabContent').html(loginForm);
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

//Listens for message to update ui
//Sort of hacky but easier than setting up constant connection
chrome.runtime.onMessage.addListener(function(msg, sender, cb){
  if(msg.type === 'update'){
    updateActionItems(true);
  }
  else if (msg.type === 'loginSuccess') {
    $('#tabMine').click();
  }
  //used to be in show links
  else if(msg.type === 'consumptions'){
    var consumptions = msg.response.user._consumptions;
    var consumableTable = '<table>';
    consumableTable += '<thead><tr><th>URL</th><th># of Times</th><th>Average</th></tr></thead>';
    //set listeners to links (for custom tab opening)
    //replicates an <a> with some more js added
    for (var i in consumptions) {
      consumptions[i]._consumable.consumptionId = consumptions[i]._id;
      consumableTable += generateConsumableListItem(consumptions[i]._consumable);
    }
    consumableTable += '</table>';
    $('#tabContent').html(consumableTable);
  }
  else if (msg.type === 'topConsumables') {
    var consumables = msg.response.consumables;
    var linkList = '<table>';
    for (var i in consumables) {
      linkList += generateConsumableListItem(consumables[i]);
    }
    linkList += '</table>';
    $('#tabContent').html(linkList);
  }
});

function generateConsumableListItem(consumable) {
  var urlText = consumable.url;
  if (urlText.length > 40) urlText = urlText.substring(0, 20) + '<br>...<br>' + urlText.substring(urlText.length - 20);
  var count = consumable.consumedCount;
  if (!count) count = 0;
  var avg = consumable.averageConsumeTime;
  if (!avg) avg = 0;


  tr = '<tr ';
  if (consumable.consumptionId) {
    tr += 'id="' + consumable.consumptionId + '" ';
  }
  tr += 'class="consumption clickable" data-url="' + consumable.url +'">'
    tr += '<td><div class="url">' + urlText + '</div></td>';
    tr += '<td >'
          + '<span class="consumptionStat">' + count + '</span>'
        + '</td>';
    tr += '<td >'
          + '<span class="consumptionStat">' + Math.trunc(avg / 1000) + '</span>' + 's'
        + '</td>';
  tr += '</tr>';


  // li += 'data-url="' + consumable.url + '" class="consumption clickable">' + consumable.url + '<br>';
  // if (consumable.consumedCount && consumable.consumedCount > 0) {
  //   li += 'Average Consume Time: ' + (consumable.averageConsumeTime / 1000) + 's<br>';
  //   li += 'Consumed: ' + (consumable.consumedCount) + ' time' + (consumable.consumedCount == 1 ? '' : 's');
  // } else {
  //   li += '<strong>Be the first to consume this! </strong>';
  // }
  return tr;
}

//TODO: figure this out
function beginConsumption(e) {
  var self = this;
  // use this to update with later
  chrome.storage.local.set({
    'currentConsumption': self.attributes.id.value
  });
  link = 'http://' + $(self).data('url');

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
          $('#consumeLink').show();
          $('#consumeLink').text('Done Consuming');
          $('#titleDiv').on('click', '#consumeLink', consumeLink);
          $('#saveLink').hide();
        } else {
          $('#saveLink').show();
          $('#saveLink').text('Add Current Page');
          $('#titleDiv').on('click', '#saveLink', saveLinks);
          $('#consumeLink').hide();
        }
      }

      var tabs = '';
      if (userState) {
        tabs += '<div class="tab clickable" data-type="getConsumptions" id="tabMine">Mine</div>';
      }
      tabs += '<div class="tab clickable" data-type="getTopConsumables" id="tabTop">Top</div>';
      $('#tabs').html(tabs);


      if (userState) {
        //////////// Logout btn
        $('#loginLogoutDiv').text('Logout');
        $('#titleDiv').on('click', '#loginLogoutDiv',logoutUser);
      }
      else {
        //////////// Login btn
        $('#loginLogoutDiv').text('Login');
        $('#titleDiv').on('click', '#loginLogoutDiv', showLoginForm);
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
  $('#tabContent').on('click', '.consumption', beginConsumption);
  $('#tabContent').on('click', '#loginForm #loginBtn', login);
  $('#tabs').on('click', '#tabMine', showLinks);
  $('#tabs').on('click', '#tabTop', showLinks);
});
