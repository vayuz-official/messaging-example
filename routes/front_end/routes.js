import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { FlowRouterTitle } from "meteor/ostrio:flow-router-title";
import { Utils } from "./../../../utils/utils";

var title = "India Today Gaming";
function checkedForLoggedIn() {
  if (
    Utils.getLoggedInUserId() == "" ||
    Utils.getLoggedInUserId() == null ||
    Utils.getLoggedInUserId() == undefined
  ) {
    FlowRouter.go("/");
  }
}
// ======================  Home page
FlowRouter.triggers.enter([
  () => {
    if ($(".navbar-menu").hasClass("is-active")) {
      $(".navbar-menu").removeClass("is-active");
      $(".navbar-burger").removeClass("is-active");
    }
    window.scrollTo(0, 0);
  },
]);

function getCorrectHeader() {
  if(Utils.getLoggedInUserId() != "" && Utils.getLoggedInUserId() != undefined ){
    return "header_itg";
  }else{
    return "header_home";
  }
  
}

FlowRouter.route('/chat', {
  action:async  function(params, queryParams) {
    await import('/public/frontend-assets/css/core.css');
    await import('/imports/loader/loader.js');
    await import('/imports/master.js');
    await import('/imports/icons/icons.js');
    await import('/imports/frontend/header/header-home.js');
    await import('/imports/no_data/no_data_image.js');
    await import('/imports/no_data/no_data.js');
      
    await import('/imports/icons/icons.js');
    await import('/imports/frontend/footer.js');
    await import('/imports/frontend/header/header_itg.js');
    await import('/imports/frontend/chat/chat.js');
    await import('/imports/frontend/chat/chat_right_panel/chat_right_panel.js');
    await import('/imports/frontend/chat/chat.css');
    BlazeLayout.render(getCorrectHeader(), {child_template_forntend: 'chat',});
  },
   title(params, query, data){
      return 'Chat | '+title;
  }
}); 


FlowRouter.route('/chat-details/:chatroomId', {
  action:async  function(params, queryParams) {
    await import('/public/frontend-assets/css/core.css');
    await import('/imports/loader/loader.js');
    await import('/imports/master.js');
    await import('/imports/icons/icons.js');
    await import('/imports/frontend/header/header-home.js');
    await import('/imports/no_data/no_data_image.js');
    await import('/imports/no_data/no_data.js');
    
    await import('/imports/icons/icons.js');
    await import('/imports/frontend/footer.js');
    await import('/imports/frontend/header/header_itg.js');
    await import('/imports/frontend/chat/chat.js');
    await import('/imports/frontend/chat/chat_right_panel/chat_right_panel.js');
    await import('/imports/frontend/chat/chat.css');
    BlazeLayout.render(getCorrectHeader(), {child_template_forntend: 'chat', chat_right_panel:'chat_right_panel'});
  },
   title(params, query, data){
      return 'Chat | '+title;
  }
}); 

if (Meteor.isClient) {
  new FlowRouterTitle(FlowRouter);
}
