import "./chat_right_panel.html";
import { FlowRouter } from "meteor/ostrio:flow-router-extra";
import Compressor from "compressorjs";
import {
  AllChatroomData,
  Chatroom,
} from "./../../../../collections/chat_collection.js";
import { Followers, GifImages } from "./../../../../collections/collection.js";
import {
  BlockUser,
  ProfileAccess,
} from "./../../../../collections/collection.js";
import {
  UnreadMessages,
  CurrentChatroomData,
} from "./../../../../collections/chat_collection.js";
import { StarredMessages } from "./../../../../collections/chat_collection.js";
import { LocalMessages } from "./../../../../collections/chat_collection.js";
import { MuteChatrooms } from "./../../../../collections/chat_collection.js";
import { TypingUsers } from "./../../../../collections/chat_collection.js";

import { Utils } from "./../../../../utils/utils.js";
import { PopupUtils } from "./../../../../utils/PopupUtils.js";
import { ErrorMessages } from "./../../../../utils/ErrorMessages.js";
import { ChatNetwork } from "./../../../../network/itg/chat-network/chat-network";
import { MessagingPojo } from "./../../../../modals/frontend/messaging/MessagingPojo.js";
import { Base64 } from "meteor/ostrio:base64";

const axios = require("axios").default;
var paginationReached = false;
var limit = 0;
var DEFAULT_LIMIT = 8;
var currentUserId = localStorage.getItem("_id");
var userOnlineTracker = 0;
const StarMessagesLocal = new Mongo.Collection(null);
var globalSocketObject = null;
var counter = 1;
var gifImageUrl = "";
var uploadedDocumentType = [
  "jpg",
  "jpeg",
  "bmp",
  "gif",
  "png",
  "mp4",
  "JPG",
  "JPEG",
  "BMP",
  "GIF",
  "PNG",
  "MP4",
];
var GphApiClient = require('giphy-js-sdk-core')

client = GphApiClient("aaaaa")


function removeBackground(){
  $("#delete-msg-modal").removeClass("is-active");
    $("#block-user-modal").removeClass("is-active");
    $("#mute-notification-modal").removeClass("is-active");
    $("#redirection-modal").removeClass("is-active");
    $("#gif-modal").removeClass("is-active");
}
Template.chat.events({
  "click .modal-background": function (event) {
    event.preventDefault();
    removeBackground();
  },
  "click .close-modal": function (event) {
    event.preventDefault();
    removeBackground();
  },
  "click #mute_notifications": async function (event) {
    event.preventDefault();
    if (
      CurrentChatroomData._collection
        .find({
          chatroom_id: getChatroomDetails().chatroomId,
          mute_notifications: true,
        })
        .count() == 0
    ) {
      $("#mute-notification-modal").addClass("is-active");
    } else {
      var obj = {};
      obj.chatroom_id = getChatroomDetails().chatroomId;
      obj.enable_mute = false;
      muteUnmuteNotifications(obj);
    }
  },
  "click #mute_notification_btn": async function (event) {
    event.preventDefault();
    var obj = {};
    obj.chatroom_id = getChatroomDetails().chatroomId;
    obj.enable_mute = true;
    muteUnmuteNotifications(obj);
  },

  "click #block_user_btn": async function (event) {
    event.preventDefault();
    if (this.user_blocked_by_current_user) {
      var obj = {};
      obj.user_id = Utils.getLoggedInUserId();
      obj.chatroom_id = getChatroomDetails().chatroomId;
      var result = await new ChatNetwork().unblockUser(obj);
      if (Utils.isObject(result.data)) {
        if (result.data.code == 200) {
          AllChatroomData._collection.update(
            { chatroom_id: obj.chatroom_id },
            { $set: { user_blocked_by_current_user: false } }
          );
          CurrentChatroomData._collection.update(
            { chatroom_id: obj.chatroom_id },
            { $set: { user_blocked_by_current_user: false } }
          );
          setTimeout(function(){
            configureControlEnter();
            $("#message_body").click();
          },500);
          if (result.data.user_online) {
            globalSocketObject.emit("user_unblocked", obj);
          }
        } else if (result.data.code == 403) {
          PopupUtils.showErrorMessageFromJWT();
          localStorage.setItem("_id", "");
          FlowRouter.go("/signin");
        } else {
          PopupUtils.showErrorPopupWithMessage(result.data.message);
        }
      } else {
        PopupUtils.showErrorPopupWithMessage(
          ErrorMessages.getNetworkTimeoutMessage()
        );
      }
    } else {
      $("#block-user-modal").addClass("is-active");
    }
  },
  "click #block_user_btn_": async function (event) {
    event.preventDefault();
    var obj = {};
    obj.user_id = Utils.getLoggedInUserId();
    obj.chatroom_id = getChatroomDetails().chatroomId;
    $("#block_user_loader").removeClass("display_hidden");
    var result = await new ChatNetwork().blockUser(obj);
    $("#block_user_loader").addClass("display_hidden");
    if (Utils.isObject(result.data)) {
      if (result.data.code == 200) {
        $("#block-user-modal").removeClass("is-active");
        AllChatroomData._collection.update(
          { chatroom_id: obj.chatroom_id },
          {
            $set: {
              user_blocked_by_current_user: true,
              user_blocked_by_other_user: false,
            },
          }
        );
        CurrentChatroomData._collection.update(
          { chatroom_id: obj.chatroom_id },
          {
            $set: {
              user_blocked_by_current_user: true,
              user_blocked_by_other_user: false,
            },
          }
        );
        if (result.data.user_online) {
          globalSocketObject.emit("user_blocked", obj);
        }
      } else if (result.data.code == 403) {
        PopupUtils.showErrorMessageFromJWT();
        localStorage.setItem("_id", "");
        FlowRouter.go("/signin");
      } else {
        PopupUtils.showErrorPopupWithMessage(result.data.message);
      }
    } else {
      PopupUtils.showErrorPopupWithMessage(
        ErrorMessages.getNetworkTimeoutMessage()
      );
    }
  },
  "click #view_profile":function(events){
    events.preventDefault();
    events.stopPropagation();
     FlowRouter.go('/profile/' + this.user_name);
  },
  "click #block_user_chat": async function (event) {
    event.preventDefault();
    event.stopPropagation();
    var chatroomDetails= AllChatroomData.find({"user_details.user_id": this.user_id}).fetch()
    var obj = {};
    if(chatroomDetails.length!=0){
      if (chatroomDetails[0].user_blocked_by_current_user) {
        var obj = {};
        obj.user_id = Utils.getLoggedInUserId();
        obj.chatroom_id = chatroomDetails[0].chatroom_id;
        var result = await new ChatNetwork().unblockUser(obj);
        if (Utils.isObject(result.data)) {
          if (result.data.code == 200) {
            AllChatroomData._collection.update(
              { chatroom_id: obj.chatroom_id },
              { $set: { user_blocked_by_current_user: false } }
            );
            CurrentChatroomData._collection.update(
              { chatroom_id: obj.chatroom_id },
              { $set: { user_blocked_by_current_user: false } }
            );
            setTimeout(function(){
              configureControlEnter();
              $("#message_body").click();
            },500);
            
            if (result.data.user_online) {
              globalSocketObject.emit("user_unblocked", obj);
            }
          } else if (result.data.code == 403) {
            PopupUtils.showErrorMessageFromJWT();
            localStorage.setItem("_id", "");
            FlowRouter.go("/signin");
          } else {
            PopupUtils.showErrorPopupWithMessage(result.data.message);
          }
        } else {
          PopupUtils.showErrorPopupWithMessage(
            ErrorMessages.getNetworkTimeoutMessage()
          );
        }
      } else {
        $("#block-user-modal").addClass("is-active");
      }

    }

   
  },
  "click #mute_notifications_": async function (event) {
    event.preventDefault();
    event.stopPropagation();
    var chatroomDetails= AllChatroomData.find({"user_details.user_id": this.user_id}).fetch()
    var obj = {};
    if(chatroomDetails.length!=0){
      obj.chatroom_id = chatroomDetails[0].chatroom_id;
    }
    if (
      AllChatroomData._collection
        .find({
          chatroom_id: obj.chatroom_id,
          mute_notifications: true,
        })
        .count() == 0
    ) {
      $("#mute-notification-modal").addClass("is-active");
    } else {
      var obj1 = {};
      obj1.chatroom_id = obj.chatroom_id;
      obj1.enable_mute = false;
      muteUnmuteNotifications(obj1);
    }
  },
  

  "click #clear_chat_":async function(event){
    event.preventDefault();
    event.stopPropagation();
      var obj = {};
      obj.user_id = this.user_id;
      var chatroomDetails= AllChatroomData.find({"user_details.user_id": this.user_id}).fetch()
      if(chatroomDetails.length!=0){
        obj.chatroom_id = chatroomDetails[0].chatroom_id;
        var result = await new ChatNetwork().clearChat(obj);
        if (Utils.isObject(result.data)) {
          if (result.data.code == 200) {
            PopupUtils.showSuccessPopup("Chat Cleared");
            
            if( FlowRouter.current().params.chatroomId !=undefined && 
            FlowRouter.current().params.chatroomId  == Utils.decodedEncodedString(obj.chatroom_id)){
              paginationReached = false;
              LocalMessages._collection.remove({});
              fetchCurrentChatroomDetails();
            }
              
          } else if (result.data.code == 403) {
            PopupUtils.showErrorMessageFromJWT();
            localStorage.setItem("_id", "");
            FlowRouter.go("/signin");
          } else {
            PopupUtils.showErrorPopupWithMessage(result.data.message);
          }
        } else {
          PopupUtils.showErrorPopupWithMessage(
            ErrorMessages.getNetworkTimeoutMessage()
          );
        }
      }else{
        PopupUtils.showErrorPopupWithMessage("Something went wrong");
      }
      
  },
  "click .three_dots_click":function(event){
    event.preventDefault();
    event.stopPropagation();
  },
  "click .modal-background": function (event) {
    event.preventDefault();
    $("#delete-msg-modal").removeClass("is-active");
    $("#block-user-modal").removeClass("is-active");
    $("#mute-notification-modal").removeClass("is-active");
  },

  "click .redirect_to_chat_details": function (event) {
    event.preventDefault();

    if ($("#nav_drawer").hasClass("open")) {
      $("#nav_drawer").removeClass("open");
    } else {

      if( FlowRouter.current().params.chatroomId !=undefined){
          paginationReached = false;
          setTimeout(function(){
            if(!Session.get("same")){
              fetchCurrentChatroomDetails();
            }
          },200)
      }  
    }
  },
});
Template.chat_right_panel.onRendered(function () {
 
  paginationReached = false;
  Session.set("total_media", 0);

  fetchCurrentChatroomDetails();

  Session.set("active_chatroom_id", getChatroomDetails().chatroomId);
  var obj = {};
  obj.user_id = Utils.getLoggedInUserId();
  obj.chatroom_id = getChatroomDetails().chatroomId;
  globalSocketObject = getSocketObj();
  getSocketObj().emit("join_web", obj);
  globalSocketObject.on("user_unblocked",function(obj){
    if(obj.user_id!=Utils.getLoggedInUserId()){
     setTimeout(function(){
        configureControlEnter();
        configureTyping();
      },500);
      
    }
  });
});

function configureControlEnter() {
  $("#message_body").keydown(function (e) {
    if ((e.ctrlKey && e.keyCode == 13) || (e.shiftKey && e.keyCode == 13)) {
      // Ctrl-Enter pressed
      // $("#message_body").text();
      $("#message_body").text($("#message_body").text() + " \n");
      return false;
    }
    if (e.keyCode == 13 && !e.shiftKey) {
      e.preventDefault();
      var messageBody = $("#message_body").text().trim();
      if(Session.get("edit_message")){
        if (messageBody == "") {
          if (!$("#upload_media_div").hasClass("display_hidden")) {
            updateMessage(messageBody, true);
          } else {
            PopupUtils.showErrorPopupWithMessage("Message cannot be empty");
          }
        } else if (!$("#upload_media_div").hasClass("display_hidden")) {
          updateMessage(messageBody, true);
        } else {
          updateMessage(messageBody, false);
        }
      }else{
        if (messageBody == "") {
          if (!$("#upload_media_div").hasClass("display_hidden")) {
            sendMessage(messageBody, true);
          } else {
            PopupUtils.showErrorPopupWithMessage("Message cannot be empty");
          }
        } else if (!$("#upload_media_div").hasClass("display_hidden")) {
          sendMessage(messageBody, true);
        } else {
          sendMessage(messageBody, false);
        }
      }
      
    }
  });
}
Template.chat_right_panel.onDestroyed(function () {
  Session.set("currentEditQuestion", undefined);
  Session.set("replyMessage", undefined);
  Session.set("active_chatroom_id", undefined);

  clearInterval(userOnlineTracker);
  CurrentChatroomData._collection.remove({});
  AllChatroomData._collection.update({},{$set:{is_active:false}},{multi:true});
});

function callForUserTyping(b) {
  getSocketObj().emit("emit_typing_event", {
    user_id: Utils.getLoggedInUserId(),
    chatroom_id: getChatroomDetails().chatroomId,
    is_typing: b,
  });
}

function updateUserOnlineChatroom(userId, chatroomId, status) {
  userOnlineTracker = setInterval(function () {
    Meteor.call(
      "update_user_online_status_with_chatroom_id",
      userId,
      status,
      chatroomId,
      function (error, result) {
        if (error) {
          // console.log("Something went wrong while updating User Status");
        } else {
          // console.log("User Is online");
        }
      }
    );
  }, 4000);
}
function configureTyping() {
  let typingTimer; //timer identifier
  let doneTypingInterval = 5000; //time in ms (5 seconds)
  let myInput = document.getElementById("message_body");
  let isTyping = false;
  //on keyup, start the countdown
  if(myInput!=null){
    myInput.addEventListener("keyup", () => {
      if (isTyping == false) {
        isTyping = true;
        callForUserTyping(true);
      }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(doneTyping, doneTypingInterval);
      // if ($("#message_body").text().trim()!="") {
      // }
    });  
  }else{
    setTimeout(function(){
      configureTyping();
    },5000);
  }
  
  //user is "finished typing," do something
  function doneTyping() {
    isTyping = false;
    //do something
    console.log("Stopped Typing");
    callForUserTyping(false);
  }
}


function getChatroomDetails() {
  var chatroomId = FlowRouter.current().params.chatroomId;
  if (chatroomId) {
    chatroomId = Utils.decodedEncodedString(chatroomId);
    return { chatroomId: chatroomId };
  }
}
async function resetUnreadMessagesCount(chatroomId, user_id) {
  AllChatroomData._collection.update(
    { chatroom_id: chatroomId },
    { $set: { unread_messages: 0 } }
  );
  var allChatrooms = UnreadMessages._collection
    .find({ chatroom_id: chatroomId })
    .fetch();
  for (var i = 0; i < allChatrooms.length; i++) {
    UnreadMessages._collection.remove({ _id: allChatrooms[i].id });
  }
  var obj = {};
  obj.user_id = user_id;
  obj.chatroom_id = chatroomId;
  var response = await new ChatNetwork().resetChatroomCount(obj);
  console.log(response.data);
  if (Utils.isObject(response.data)) {
    if (response.data.code == 200) {
      console.log("Count resetted");
      if (response.data.user_online) {
        //Emitting
        console.log("Emitting");
        getSocketObj().emit("reset_delivery_status_in_bulk", obj);
      }
    } else if (response.data.code == 403) {
      PopupUtils.showErrorMessageFromJWT();
      localStorage.setItem("_id", "");
      FlowRouter.go("/signin");
    } else {
      PopupUtils.showErrorPopupWithMessage(response.data.message);
    }
  } else {
    PopupUtils.showErrorPopupWithMessage(
      ErrorMessages.getNetworkTimeoutMessage()
    );
  }
}
async function fetchCurrentChatroomDetails() {
  var currentChatroomDetails = CurrentChatroomData._collection.find({}).count();
  if (currentChatroomDetails == 0) {
    var obj = {};
    obj.chatroom_id = getChatroomDetails().chatroomId;
    var result = await new ChatNetwork().fetchChatroomBasedOnId(obj);
    console.log(result.data);
    if (Utils.isObject(result.data)) {
      if (result.data.code == 200) {
        if (result.data.data.length != 0) {
          if (
            CurrentChatroomData._collection
              .find({ chatroom_id: result.data.data[0].chatroom_id })
              .count() == 0
          )
          
            if (
              result.data.data[0].user_is_blocked_by_current_user.length != 0
            ) {
              result.data.data[0].user_blocked_by_current_user = true;
            } else if (
              result.data.data[0].user_is_blocked_by_other_user.length != 0
            ) {
              result.data.data[0].user_blocked_by_other_user = true;
            }
          if (result.data.data[0].is_mute_chatroom.length != 0) {
            result.data.data[0].mute_notifications = true;
          }
          if (result.data.data[0].is_creator) {
            result.data.data[0].user_details = result.data.data[0].other_user_details;
          } else {
            result.data.data[0].user_details = result.data.data[0].creator_details;
          }
          CurrentChatroomData._collection.insert(result.data.data[0]);
        }
        paginationReached = false;
        fetchAllMessages(20);
        setTimeout(function () {
          configureControlEnter();
          configureTyping();
        }, 500);

        if (result.data.data[0].unread_messages != 0) {
          resetUnreadMessagesCount(obj.chatroom_id, Utils.getLoggedInUserId());
        }
      } else if (result.data.code == 403) {
        PopupUtils.showErrorMessageFromJWT();
        localStorage.setItem("_id", "");
        FlowRouter.go("/signin");
      } else {
        PopupUtils.showErrorPopupWithMessage(result.data.message);
      }
    } else {
      PopupUtils.showErrorPopupWithMessage(
        ErrorMessages.getNetworkTimeoutMessage()
      );
    }
  }
}
function checkIfExists() {
  var check =
    AllChatroomData._collection
      .find({ chatroom_id: getChatroomDetails().chatroomId })
      .count() == 1;
  if (check) {
    AllChatroomData._collection.update(
      { chatroom_id: getChatroomDetails().chatroomId },
      { $set: { is_active: true } }
    );
    return false;
  } else {
    return true;
  }
}

async function fetchAllMessages(limit) {
  var scroll = false;
  var oldMessagesCount = 0;
  if (limit == 0) {
    limit = DEFAULT_LIMIT;
    scroll = true;
  } else {
    oldMessagesCount = LocalMessages._collection
      .find({ chatroom_id: getChatroomDetails().chatroomId })
      .count();
  }

  var obj = {};
  obj.chatroom_id = getChatroomDetails().chatroomId;
  obj.limit = limit;
  obj.skip = oldMessagesCount;
  if (obj.skip == 0) {
    obj.skip = 1;
  }
  obj.query = FlowRouter.current().queryParams.query;
 
  Session.set("searchActive",obj.query!=undefined)
  if(obj.query!=undefined){
    $("#search_messages").val(obj.query);
  }
  var result = await new ChatNetwork().fetchAllMessages(obj);
  
  if (Utils.isObject(result.data)) {
    if (result.data.code == 200) {
      if (result.data.code == 200) {
        for (var i = 0; i < result.data.data.length; i++) {
          if (limit == DEFAULT_LIMIT) {
            result.data.data[i].index = i;
          } else {
            result.data.data[i].index = i + obj.skip;
          }
          var checkifExists = LocalMessages._collection
            .find({ _id: result.data.data[i]._id })
            .count();
          if (checkifExists == 0) {
            LocalMessages._collection.insert(result.data.data[i]);
          }
        }
      }
      if (obj.limit == 20) {
        $.getScript(
          "https://cdnjs.cloudflare.com/ajax/libs/jquery.waitforimages/2.4.0/jquery.waitforimages.min.js",
          function () {
            $(".attachment_images")
              .waitForImages()
              .done(function () {
                var count = 0;
                for (var i = 0; i < result.data.data.length; i++) {
                  if (result.data.data[i].attachment_url != undefined) {
                    count++;
                  }
                }
                scrollToBottom();
                setTimeout(function () {
                  $(".attachment_images")
                    .waitForImages()
                    .done(function () {
                      scrollToBottom();
                    });
                }, 300 * count);
              });
          }
        );
      }

      setTimeout(function () {
        Utils.loadIconsAndDropdowns();
      }, 1000);

      if (scroll) {
        setTimeout(function () {
          $("#all_messages_div").animate(
            { scrollTop: $("#all_messages_div").prop("scrollHeight") },
            1
          );
        }, 100);
      } else {
        setTimeout(function () {
          if (document.getElementById(oldMessagesCount)) {
            document
              .getElementById(oldMessagesCount)
              .scrollIntoView({ behavior: "smooth" });
          }
        }, 1000);
      }
    } else if (result.data.code == 403) {
      PopupUtils.showErrorMessageFromJWT();
      localStorage.setItem("_id", "");
      FlowRouter.go("/signin");
    } else {
      PopupUtils.showErrorPopupWithMessage(result.data.message);
    }
  } else {
    PopupUtils.showErrorPopupWithMessage(
      ErrorMessages.getNetworkTimeoutMessage()
    );
  }
}

Template.chat_right_panel.helpers({
  "search_gif_active":function(){
    return Session.get("search_gif_active");
  },
  searched_gif:function(){
    return Session.get("searched_gif");
  },
  "all_gif_images":function(){
    return GifImages.find({}).fetch();
  },
  "search_active":function(){
    return Session.get("searchActive");
  },
  check_if_content_length_is_greater_than_: function (string, count) {
    if (string && string.replace(/<br *\/?>/gi, "\n").length > count) {
      return true;
    }
  },
  trim_characters_0_100: function (string, count) {
    if (string && string.replace(/<br *\/?>/gi, "\n").length > count) {
      return string
        .replace(
          /(https?:\/\/[^\s]+)/g,
          "<a class='link-url-chat' href='$1' target='_blank' >$1</a>"
        )
        .replace(/<br *\/?>/gi, "\n")
        .substr(0, count);
    }
  },
  change_format: function (str) {
    if (str != undefined) {
      return str
        .replace(
          /(https?:\/\/[^\s]+)/g,
          "<a class='link-url-chat' href='$1' target='_blank' >$1</a>"
        )
        .replace(/\n/g, "<br/>");
    }
  },
  currently_active_chatroom_details: function () {
    var currentChatroomDetails = CurrentChatroomData._collection
      .find({}, { limit: 1 })
      .fetch();
    for (var i = 0; i < currentChatroomDetails.length; i++) {
      if (currentChatroomDetails[i].is_creator) {
        currentChatroomDetails[i].user_details =
          currentChatroomDetails[i].other_user_details;
      } else {
        currentChatroomDetails[i].user_details =
          currentChatroomDetails[i].creator_details;
      }
    }
    return currentChatroomDetails;
  },
  
  fetch_all_messages: function () {
    if (Session.get("starMessageActivated")) {
      return StarMessagesLocal.find({}, { sort: { created_at: 1 } }).fetch();
    }
    if (getChatroomDetails() != undefined) {
      var allMessages = LocalMessages.find(
        { chatroom_id: getChatroomDetails().chatroomId },
        { sort: { created_at: 1 } }
      ).fetch();
      allMessages = Utils.findUnique(allMessages, (d) => d.message_id);
      return allMessages;
    }
  },
});

function configureLoader(id1, b) {
  if (b) {
    $(id1).addClass("display-none");
  } else {
    $(id1).removeClass("display-none");
  }
}

function scrollToBottom() {
  setTimeout(function () {
    $("#all_messages_div").animate(
      { scrollTop: $("#all_messages_div").prop("scrollHeight") },
      "slow"
    );
  }, 10);
}

function getOtherUserId() {
  var currentChatroomDetails = CurrentChatroomData._collection.find({}).fetch();
  for (var i = 0; i < currentChatroomDetails.length; i++) {
    if (currentChatroomDetails[i].is_creator) {
      currentChatroomDetails[i].user_details =
        currentChatroomDetails[i].other_user_details;
    } else {
      currentChatroomDetails[i].user_details =
        currentChatroomDetails[i].creator_details;
    }

    if (currentChatroomDetails[i].user_details.length != 0) {
      return currentChatroomDetails[i].user_details[0].user_id;
    }
  }
}
async function muteUnmuteNotifications(obj) {
  if (obj.enable_mute) {
    $("#mute_notification_loader").removeClass("display_hidden");
  }

  var result = await new ChatNetwork().muteNotifications(obj);
  if (obj.enable_mute) {
    $("#mute_notification_loader").addClass("display_hidden");
  }

  if (Utils.isObject(result.data)) {
    if (result.data.code == 200) {
      if (obj.enable_mute) {
        $("#mute-notification-modal").removeClass("is-active");
      }
      AllChatroomData._collection.update(
        { chatroom_id: obj.chatroom_id },
        { $set: { mute_notifications: obj.enable_mute } }
      );
      CurrentChatroomData._collection.update(
        { chatroom_id: obj.chatroom_id },
        { $set: { mute_notifications: obj.enable_mute } }
      );
      PopupUtils.showSuccessPopup(result.data.message);
    } else if (result.data.code == 403) {
      PopupUtils.showErrorMessageFromJWT();
      localStorage.setItem("_id", "");
      FlowRouter.go("/signin");
    } else {
      PopupUtils.showErrorPopupWithMessage(result.data.message);
    }
  } else {
    PopupUtils.showErrorPopupWithMessage(
      ErrorMessages.getNetworkTimeoutMessage()
    );
  }
}


function isURL(str) {
  return new RegExp(
    "([a-zA-Z0-9]+://)?([a-zA-Z0-9_]+:[a-zA-Z0-9_]+@)?([a-zA-Z0-9.-]+\\.[A-Za-z]{2,4})(:[0-9]+)?(/.*)?"
  ).test(str);
}
function fetch_meta_information_in_url(output) {
  if (isURL(output)) {
    Session.set("post_type", "metadata_url");
    $("#uploading_data_div").removeClass("display_hidden");
    Meteor.call("fetch_url_information", output, function (error, result) {
      if (error) {
        $("#uploading_data_div").removeClass("display_hidden");
        swal("Please enter a valid URL");
      } else {
        console.log(result);
        if ($("#message_body").text().trim() == "") {
          $("#url_metadata_div").addClass("display_hidden");
          $("#uploading_data_div").addClass("display_hidden");
          return false;
        }

        // if(Session.get("request_send")=="false"){
        $("#uploading_data_div").removeClass("display_hidden");
        $("#url_metadata_div").removeClass("display_hidden");
        Session.set("request_send", "true");
        var result_string = JSON.stringify(result);
        var title = JSON.parse(result_string);
        
        try{
          if (title.image != "") {
            $("#metadata_image").attr("src", title.image);
          } else {
            $("#metadata_image").attr(
              "src",
              "/frontend-assets/images/logo/itg-logo.png"
            );
          }
          $("#metadata_url").attr("href", title.url);
  
          var title1 = title.title;
          if (title1 == undefined) {
            $("#url_metadata_div").addClass("display_hidden");
            return false;
          }
          console.log("3");
          //   if(title1.length>38){
          $("#metadata_title").text(title1);
          //   }else{
          //   $("#metadata_title").text(title1);
          //   }
          console.log("4");
          $("#metadata_source").text(title.source);
          $("#metadata_description").text(title.description);
          $("#uploading_data_div").addClass("display_hidden");
          $("#add_photos_link").addClass("display_hidden");
          $("#add_video_link").addClass("display_hidden");
        }catch(e){
          swal("Sorry, Unable to fetch details!!!");
          console.log("Expection")
        }
        
        // }
      }
    });
  } else {
    resetMeta();
  }
}


function resetMeta() {
  $("#url_metadata_div").addClass("display_hidden");
  $("#metadata_source").text("");
  $("#metadata_title").text("");
  $("#metadata_image").attr("src", "");
  $("#metadata_url").attr("href", "");
  $("#metadata_description").text("");
  $("#add_photos_link").removeClass("display_hidden");
  $("#add_video_link").removeClass("display_hidden");
}


Template.chat_right_panel.events({
  "click #cross_icon_btn":function(event){
    event.preventDefault();
    $("#search_gif").val("");
    $("#gif-picker").click();
  },
  "keyup #search_gif":function(event){
    event.preventDefault();
    if (event.which === 13) {
      if($("#search_gif").val() != ""){
        $("#search_gif").blur();
        Session.set("search_gif_active",true);
        Session.set("searched_gif", $("#search_gif").val().trim());
        GifImages._collection.remove({});
        client.search('gifs', {"q": $("#search_gif").val().trim()})
          .then((response) => {
            response.data.forEach((gifObject) => {
              for(var i=0;i<response.data.length;i++){
                if(GifImages.find({"url":response.data[i].embed_url}).count() == 0 )
                GifImages._collection.insert({"url":response.data[i].embed_url})  
              }
            })
          })
          .catch((err) => {
        
          })
      }else{
        GifImages._collection.remove({});
        $("#search_gif").val("");
        client.trending("gifs", {})
        .then((response) => {
          if(response.data!=undefined){
            for(var i=0;i<response.data.length;i++){
              // GifImages._collection.insert({"url":response.data[i].images.downsized_still.url})  
              if(GifImages.find({"url":response.data[i].embed_url}).count() == 0 )
              GifImages._collection.insert({"url":response.data[i].embed_url})  
            }
          }
        })
        .catch((err) => {
            console.log(err);
        })
        Session.set("search_gif_active",false);
        PopupUtils.showErrorPopupWithMessage("Search can not be empty");
      }
      
    }
  },
  "click #gif_div":function(event){
    event.preventDefault();
    gifImageUrl = this.url;
    $("#gif-modal").removeClass("is-active");
    sendMessage("GIF_IMAGE_GIF_123_GIF_IMAGE", true);
  
  },
  "click #gif-picker":function(){
      $("#gif-modal").addClass('is-active');

      client.trending("gifs", {})
        .then((response) => {
          if(response.data!=undefined){
            for(var i=0;i<response.data.length;i++){
              // GifImages._collection.insert({"url":response.data[i].images.downsized_still.url})  
              if(GifImages.find({"url":response.data[i].embed_url}).count() == 0 )
              GifImages._collection.insert({"url":response.data[i].embed_url})  
            }
          }
        })
        .catch((err) => {
            console.log(err);
        })
    },
  "click #metadata_card":function(event){
    event.preventDefault();
    $("#redirection-modal").addClass("is-active");
    Session.set("link",this.metadata_details.metadata_url);
  },
  "click #redirection_confirm":function(event){
    event.preventDefault();
    $("#redirection-modal").removeClass("is-active");
    Utils.openInNewTab(Session.get("link"));
  },
  "click .remove_meta": function (event) {
    event.preventDefault();
    resetMeta();
  },
  "paste #message_body": function () {
    // event.preventDefault();
    setTimeout(function () {
      var urlInPastedString = $("#message_body")
        .text()
        .match(/\bhttps?:\/\/\S+/gi);
      if (urlInPastedString!=null && urlInPastedString.length != 0) {
        // alert("URL has been pasted");
        fetch_meta_information_in_url(urlInPastedString[0]);
      }else{
        // alert("No URL has been pasted");
      }
    }, 700);
  },
  "click .clear_search":function(event){
    event.preventDefault();
    FlowRouter.setQueryParams({query:null});
    $("#search_messages").val("");
    Session.set("searchActive",false);
    LocalMessages._collection.remove({});
    fetchAllMessages(20);
    
  },
  'keypress #search_messages': function (evt) {
    if (evt.which === 13) {
      if($("#search_messages").val().trim() == ""){
        PopupUtils.showErrorPopupWithMessage("Search cannot be empty");
      }else{
        Session.set("searchActive",true);
        FlowRouter.setQueryParams({query:$("#search_messages").val().trim()});
        LocalMessages._collection.remove({});
        fetchAllMessages(20);
      }
    }
  },
  'keypress .edit_message_body': function (evt) {
    if (evt.which === 13) {
      if($("#edit_message_div_" + this.message_id).text().trim() == ""){
        PopupUtils.showErrorPopupWithMessage("Messagea cannot be empty");
      }else{
        
      }
    }
  },
  "click #clear_chat":async function(event){
    event.preventDefault();
      var obj = {};
      obj.user_id = Utils.getLoggedInUserId();
      obj.chatroom_id = getChatroomDetails().chatroomId;
      var result = await new ChatNetwork().clearChat(obj);
      if (Utils.isObject(result.data)) {
        if (result.data.code == 200) {
            PopupUtils.showSuccessPopup("Chat Cleared");
            paginationReached = false;
            LocalMessages._collection.remove({});
            fetchCurrentChatroomDetails();
        } else if (result.data.code == 403) {
          PopupUtils.showErrorMessageFromJWT();
          localStorage.setItem("_id", "");
          FlowRouter.go("/signin");
        } else {
          PopupUtils.showErrorPopupWithMessage(result.data.message);
        }
      } else {
        PopupUtils.showErrorPopupWithMessage(
          ErrorMessages.getNetworkTimeoutMessage()
        );
      }
  },
 
  "click #upload_media_div": function (event) {
    event.preventDefault();
    $("#upload_media_div").addClass("display_hidden");
    $("#uploaded_image").attr("src", "");
  },
  "change #add_photos_file_picker_": async function (event, template) {
    event.stopPropagation();
    counter = 1;
    var maxCounter = event.currentTarget.files.length;
    Session.set("post_type", "media");
    for (i = 0; i < event.currentTarget.files.length; i++) {
      var type = event.currentTarget.files[i].type;
      const name = event.target.files[i].name;
      const lastDot = name.lastIndexOf(".");
      const fileName = name.substring(0, lastDot);
      const ext = name.substring(lastDot + 1);
      if (uploadedDocumentType.includes(ext)) {
        if (Session.get("total_media") < 5) {
          Session.set("total_media", parseInt(Session.get("total_media")) + 1);
          await upload_media(
            event,
            template,
            "photos",
            i,
            type,
            counter,
            maxCounter
          );
        } else {
          if (!$("#uploading_data_div").hasClass("display_hidden")) {
            $("#uploading_data_div").addClass("display_hidden");
          }
          PopupUtils.showErrorPopupWithMessage(
            "You can upload upto 5 media files maximum"
          );
          i++;
        }
      } else {
        i++;
        PopupUtils.showErrorPopupWithMessage(
          fileName + "  rejected becuase of unsupported extension"
        );
      }
      counter++;
    }
  },
  "click #local_file": function (event) {
    event.preventDefault();
    document.getElementById("add_photos_file_picker_").click();
    event.target.value = "";
  },

  "click .close-modal": function (event) {
    event.preventDefault();
    removeBackground();
  },

  "click #delete_message_btn": async function (event) {
    event.preventDefault();
    var obj = {};
    obj.user_id = Utils.getLoggedInUserId();
    obj.message_id = Session.get("delete_message_id");
    obj.chatroom_id = getChatroomDetails().chatroomId;
    $("#delete_message_loader").removeClass("display_hidden");
    var result = await new ChatNetwork().deleteMessage(obj);
    $("#delete_message_loader").addClass("display_hidden");
    if (Utils.isObject(result.data)) {
      if (result.data.code == 200) {
        LocalMessages._collection.update(
          { message_id: obj.message_id },
          { $set: { is_deleted: true } }
        );

        var checkIfLast = LocalMessages.find(
          {},
          { sort: { created_at: -1 }, limit: 1 }
        ).fetch();
        if (checkIfLast.length != 0) {
          AllChatroomData._collection.update(
            { chatroom_id: checkIfLast[0].chatroom_id },
            { $set: { last_message: "Message deleted" } }
          );
        }

        $("#delete-msg-modal").removeClass("is-active");
        console.log(result.data);
        if (result.data.user_online) {
          globalSocketObject.emit("delete_message", obj.message_id);
        }
      } else if (result.data.code == 403) {
        PopupUtils.showErrorMessageFromJWT();
        localStorage.setItem("_id", "");
        FlowRouter.go("/signin");
      } else {
        PopupUtils.showErrorPopupWithMessage(result.data.message);
      }
    } else {
      PopupUtils.showErrorPopupWithMessage(
        ErrorMessages.getNetworkTimeoutMessage()
      );
    }
  },
  "click #delete_message": function (event) {
    event.preventDefault();
    Session.set("delete_message_id", this.message_id);
    $("#delete-msg-modal").addClass("is-active");
  },
  "click .read-more": function (event) {
    event.preventDefault();
    $("#invisible_post_content_" + this.message_id).removeClass(
      "display_hidden"
    );
    $("#visible_post_content_" + this.message_id).addClass("display_hidden");
    $("#read_more_" + this.message_id).addClass("display_hidden");
    $("#read_less_" + this.message_id).removeClass("display_hidden");
  },
  "click .read-less": function (event) {
    event.preventDefault();
    $("#invisible_post_content_" + this.message_id).addClass("display_hidden");
    $("#visible_post_content_" + this.message_id).removeClass("display_hidden");
    $("#read_less_" + this.message_id).addClass("display_hidden");
    $("#read_more_" + this.message_id).removeClass("display_hidden");
  },
  "click #back_btn_redirection": function (event) {
    event.preventDefault();
    if (Session.get("starMessageActivated")) {
      Session.set("starMessageActivated", false);
      scrollToBottom();
      return false;
    }
    FlowRouter.go("/chat");
  },
  
  "click .modal-background": function (event) {
    removeBackground();
  },
  "scroll #all_messages_div": function (event) {
    var pos = $("#all_messages_div").scrollTop();
    if (pos == 0 && !paginationReached) {
      var currentMessages = LocalMessages._collection
        .find({ chatroom_id: getChatroomDetails().chatroomId })
        .count();
      if (
        LocalMessages._collection.find({ message_type: "LOADER" }).count() == 0
      ) {
        LocalMessages._collection.insert({
          message_type: "LOADER",
          chatroom_id: getChatroomDetails().chatroomId,
          created_at: 8408595000,
        });
        console.log("inserted");
      }
      fetchAllMessages(currentMessages + 8)
        .then(function () {
          LocalMessages._collection.remove({ message_type: "LOADER" });
          var oldMesasges = currentMessages;
          var newCount = LocalMessages._collection
            .find({ chatroom_id: getChatroomDetails().chatroomId })
            .count();
          if (oldMesasges == newCount) {
            setTimeout(function () {
              document
                .getElementById("0_index")
                .scrollIntoView({ block: "start", behavior: "auto" });
            }, 100);
            paginationReached = true;
          } else {
            setTimeout(function () {
              document
                .getElementById("6_index")
                .scrollIntoView({ block: "start", behavior: "auto" });
            }, 100);
          }
        })
        .catch(function () {
          console.log("Error");
        });
    }
  },
  "click .replied-section": function (event) {
    event.preventDefault();
    var messagesDetails = LocalMessages.find({
      message_id: this.message_id,
    }).fetch();
    if (messagesDetails.length != 0) {
      if (
        messagesDetails[0].index != null ||
        messagesDetails[0].index != undefined
      ) {
        document
          .getElementById("" + messagesDetails[0].index)
          .scrollIntoView({ behavior: "smooth" });
      }
    }
  },
  "click #reply_messages": function (event) {
    event.preventDefault();
    Session.set("replyMessage", this.message_id);
    $("#message_body").text("");
    $("#send_btn").html(
      '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><polyline points="15 10 20 15 15 20"></polyline><path d="M4 4v7a4 4 0 0 0 4 4h12"></path></svg> Reply <span  id="loader" class="fa fa-spinner fa-spin display-none"></span>'
    );
    $("#cancel_btn").removeClass("display-none");
    setTimeout(function () {
      $("#dropdown_for_message_" + Session.get("replyMessage")).removeClass(
        "is-active"
      );
    }, 100);
  },
  "click #cancel_btn": function (event) {
    event.preventDefault();
    $("#send_btn").html(
      '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Send <span  id="loader" class="fa fa-spinner fa-spin display-none"></span>'
    );
    $("#cancel_btn").addClass("display-none");
    $("#message_body").text("");
    Session.set("currentEditQuestion", undefined);
    Session.set("replyMessage", undefined);
  },
  "click #star_message": async function (event) {
    event.preventDefault();
    var obj = {};
    if (this.is_starred == undefined) {
      obj.is_starred = true;
    } else {
      obj.is_starred = !this.is_starred;
    }
    obj.message_id = this.message_id;
    obj.chatroom_id = this.chatroom_id;
    obj.user_id = currentUserId;
    $("#star_message_loader_" + obj.message_id).removeClass("display-none");
    var messageStared = await new ChatNetwork().updateMessageStarStatus(obj);

    // console.log('messageStared');
    // console.log(messageStared);

    if (messageStared.status == 200) {
      $("#star_message_loader_" + obj.message_id).addClass("display-none");
      LocalMessages._collection.update(
        { message_id: obj.message_id },
        { $set: { is_starred: !this.is_starred } },
        { multi: true }
      );
      $("#dropdown_for_message_" + obj.message_id).removeClass("is-active");
    } else {
      // Something went wrong
    }
  },
  "click #edit_message": function (event) {
    event.preventDefault();
    Session.set("edit_message",true);
    Session.set("edited_message_id",this.message_id);   
    $("#send_button_for_update_msg").removeClass("display_hidden");
    $("#message_body").text(this.message);
    if(this.attachment_url!=undefined){
      $("#upload_media_div").removeClass("display_hidden");
      $("#uploaded_image").attr("src",this.attachment_url);
    } 
  },
  "click #send_button_for_update_msg":function(event){
    event.preventDefault();
    var messageBody = $("#message_body").text().trim();
    if (messageBody == "") {
      if (!$("#upload_media_div").hasClass("display_hidden")) {
        updateMessage(messageBody, true);
      } else {
        PopupUtils.showErrorPopupWithMessage("Message cannot be empty");
      }
    } else if (!$("#upload_media_div").hasClass("display_hidden")) {
      updateMessage(messageBody, true);
    } else {
      updateMessage(messageBody, false);
    }
  },
 
});

function resetTextArea() {
  var textarea = document.getElementById("message_body");
  textarea.setAttribute("style", "");
  textarea.value = "";
}

async function sendMessage(messageBody, attachment) {
    is_gif = false;  
    let messagingPojo = {};
    messagingPojo.user_id = currentUserId;
    if (attachment) {
      if(messageBody == "GIF_IMAGE_GIF_123_GIF_IMAGE"){
        messagingPojo.message = "";
        messagingPojo.messageAttachment = gifImageUrl;
         is_gif= true;
      }else{
        messagingPojo.message = messageBody;
        messagingPojo.messageAttachment = $("#uploaded_image").attr("src");
      }
      messagingPojo.messageType = "ATTACHMENT";
    } else {
      messagingPojo.message = messageBody;
      messagingPojo.messageType = "TEXT";
    }
    if (!$("#url_metadata_div").hasClass("display_hidden")) {
      messagingPojo.metadata_post = true;
      messagingPojo.metadata_details= {};
      messagingPojo.metadata_details.metadata_source = $("#metadata_source").text();
      messagingPojo.metadata_details.metadata_title = $("#metadata_title").text();
      messagingPojo.metadata_details.metadata_image = $("#metadata_image").attr("src");
      messagingPojo.metadata_details.metadata_url = $("#metadata_url").attr("href");
      messagingPojo.metadata_details.metadata_description = $("#metadata_description" ).text();
    }
    messagingPojo.not_sent = true;
    messagingPojo.chatroomId = getChatroomDetails().chatroomId;
    configureLoader("#loader", false);
    requestSent = true;

    $("#message_body").text("");
    messagingPojo.chatroom_id = messagingPojo.chatroomId;  
    messagingPojo.local_message_id = 'message_id_'+Date.now(); 
    messagingPojo.created_at = Date.now();
    messagingPojo.created_by = messagingPojo.user_id; 
    if(is_gif){
      messagingPojo.is_gif = is_gif;
    }
    LocalMessages._collection.insert(messagingPojo);
    // requestSent = false;
    scrollToBottom();
    var result = await new ChatNetwork().sendMessage(messagingPojo);
   
    if (Utils.isObject(result.data)) {
      if (result.data.code == 200) {
        resetMeta();
        if (result.data.user_online) {
          messagingPojo.message_id = result.data.data.message_id;
          messagingPojo.chatroom_muted = result.data.data.chatroom_muted;
          globalSocketObject.emit("new_message_to_user", messagingPojo);
        }
        if(result.data.data){
          result.data.data.not_sent = false;
        }
        LocalMessages._collection.update({'local_message_id':messagingPojo.local_message_id},{$set:result.data.data});
        if (messagingPojo.messageType != "TEXT") {
          $("#cross_btn").click();
          AllChatroomData._collection.update(
            { chatroom_id: messagingPojo.chatroomId },
            {
              $set: {
                last_message: "<i class='fa fa-paperclip'></i> Media",
                unread_messages: 0,
                last_message_time: Date.now(),
              },
            }
          );
        } else {
          AllChatroomData._collection.update(
            { chatroom_id: messagingPojo.chatroomId },
            {
              $set: {
                last_message: messagingPojo.message,
                unread_messages: 0,
                last_message_time: Date.now(),
              },
            }
          );
        }
        if (!$("#upload_media_div").hasClass("display_hidden")) {
          $("#upload_media_div").addClass("display_hidden");
          $("#uploaded_image").attr("src", "");
        }
        // $("#send_btn").addClass("is-disabled");
        resetTextArea();
        requestSent = false;
        scrollToBottom();
      
        setTimeout(function () {
          Utils.loadIconsAndDropdowns();
        }, 1000);
        
      } else if (result.data.code == 403) {
        PopupUtils.showErrorMessageFromJWT();
        //   localStorage.setItem("_id", "");
        //   FlowRouter.go("/signin");
      } else {
        PopupUtils.showErrorPopupWithMessage(result.data.message);
      }
    } else {
      PopupUtils.showErrorPopupWithMessage(
        ErrorMessages.getNetworkTimeoutMessage()
      );
    }
  // }
}

async function updateMessage(messageBody, attachment) {
  // if (!requestSent) {
    let messagingPojo = {};
    messagingPojo.user_id = currentUserId;
    if (attachment) {
      messagingPojo.message = messageBody;
      messagingPojo.messageAttachment = $("#uploaded_image").attr("src");
      messagingPojo.attachment_url = $("#uploaded_image").attr("src");
      messagingPojo.messageType = "ATTACHMENT";
    } else {
      messagingPojo.message = messageBody;
      messagingPojo.messageType = "TEXT";
    }
    // messagingPojo.not_sent = true;
    var message_id = Session.get('edited_message_id');
    messagingPojo.message_id = message_id;
    messagingPojo.chatroomId = getChatroomDetails().chatroomId;
    messagingPojo.is_edited = true;
    configureLoader("#loader", false);
    requestSent = true;

    $("#message_body").text("");
    messagingPojo.chatroom_id = messagingPojo.chatroomId;   
    messagingPojo.created_by = messagingPojo.user_id; 
    
    LocalMessages._collection.update({message_id: message_id},{$set:messagingPojo});
    var result = await new ChatNetwork().updateMessage(messagingPojo);   
    if (Utils.isObject(result.data)) {
      if (result.data.code == 200) {
        Session.set("edit_message",false);
        if (result.data.user_online) {
          messagingPojo.message_id = message_id;
          globalSocketObject.emit("message_updated", messagingPojo);
        }
        var checkLastMessage = AllChatroomData.find({'last_message_details.message_id': messagingPojo.message_id}).fetch();                                                                        
              if(checkLastMessage.length!=0){
                var last_message_details = checkLastMessage[0].last_message_details;
                var last_message ="";
                if(messagingPojo.messageAttachment==undefined || messagingPojo.messageAttachment==""){
                  last_message_details[0].message = messagingPojo.message;
                  last_message = messagingPojo.message;
                }else{
                  last_message_details[0].message = "<i class='fa fa-paperclip'></i> Media";
                  last_message = "<i class='fa fa-paperclip'></i> Media";
                }
                
                AllChatroomData._collection.update({_id: checkLastMessage[0]._id},{$set:{last_message_details:last_message_details,last_message:last_message}});
              }
        if (!$("#upload_media_div").hasClass("display_hidden")) {
          $("#upload_media_div").addClass("display_hidden");
          $("#uploaded_image").attr("src", "");
        }
        // $("#send_btn").addClass("is-disabled");
        resetTextArea();
      } else if (result.data.code == 403) {
        PopupUtils.showErrorMessageFromJWT();
          // localStorage.setItem("_id", "");
          // FlowRouter.go("/signin");
      } else {
        PopupUtils.showErrorPopupWithMessage(result.data.message);
      }
    } else {
      PopupUtils.showErrorPopupWithMessage(
        ErrorMessages.getNetworkTimeoutMessage()
      );
    }
}
function getSocketObj() {
  var io = require("socket.io-client");
  return  io.connect(Meteor.absoluteUrl() + "mobile-chat");;
}



function upload_media(e, template, source, i, type, counter, maxCounter) {
  if (e.currentTarget.files && e.currentTarget.files[i]) {
    var file = e.currentTarget.files[i];
    if (file) {
      if (!type.includes("video")) {
        new Compressor(file, {
          quality: 0.6,
          maxHeight: 600,
          maxWidth: 850,
          success(result) {
            var form = new FormData();
            form.append("files", result);
            upload_content(
              form,
              e,
              template,
              source,
              i,
              type,
              counter,
              maxCounter
            );
          },
          error(err) {
            console.log(err.message);
          },
        });
      } else {
        // Session.set("video_uploaded",true);
        $("#add_video_link").addClass("video_already_added");
        var form = new FormData();
        form.append("files", file);
        upload_content(form, e, template, source, i, type, counter, maxCounter);
      }
    }
  }
}

async function upload_content(
  form,
  e,
  template,
  source,
  i,
  type,
  counter,
  maxCounter
) {
  var url = "/upload_files_content";
  var settings = {
    async: true,
    crossDomain: true,
    url: url,
    method: "POST",
    processData: false,
    contentType: false,
    mimeType: "multipart/form-data",
    data: form,
    headers: {
      "cache-control": "no-cache",
    },
  };
  if (i == 0) {
    $("#uploading_data_loader").removeClass("display_hidden");
    $("#uploading_data_div").removeClass("display_hidden");
  }

  ajaxRequest = $.ajax(settings).done(function (response) {
    if (ajaxRequest != null) {
      var res = JSON.parse(response);
      $("#uploading_data_loader").addClass("display_hidden");
      $("#uploading_data_div").addClass("display_hidden");
      $("#upload_media_div").removeClass("display_hidden");
      $("#uploaded_image").attr(
        "src",
        Utils.defaultS3StorageURL() + res.s3_url
      );

    }
  });
}