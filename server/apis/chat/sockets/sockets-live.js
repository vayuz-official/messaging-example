import io from "socket.io";
import { Meteor } from "meteor/meteor";
import { WebApp } from "meteor/webapp";
var Fiber = require("fibers");
import {
  User,
  Followers,
  BlockUser,
  AskQuestion,
  ProfileAccess,
  QueryAnswer,
} from "./../../../../collections/collection.js";
import {
  ChatroomLogs,
  OnlineUsers,
  Chatroom,
  TypingUsers,
  StarredMessages,
  Messages,
  MuteChatrooms,
} from "./../../../../collections/chat_collection.js";
import express from "express";
const { httpServer } = WebApp;

Meteor.onConnection(function (conn) {
  conn.onClose(function () {
    var checkIfConnectionIdExists = User.find({
      connection_id: conn.id,
    }).fetch();
    if (checkIfConnectionIdExists.length == 1) {
      var checkIfOnline = OnlineUsers.find({
        user_id: checkIfConnectionIdExists[0].user_id,
      }).fetch();
      for (var i = 0; i < checkIfOnline.length; i++) {
        OnlineUsers.remove({ _id: checkIfOnline[i]._id });
      }
    }
  });
});


Meteor.startup(() => {
  io(httpServer)
    .of("/mobile-chat")
    .on("connection", (socket) => {
      // console.log("inside socket conection");

      socket.on('join_web', function (obj) {
          Fiber(function () {
              change_user_online_status(obj.user_id, obj.chatroom_id, true, socket);
          }).run();
      });
      socket.on('emit_typing_event',function(obj){
        socket.broadcast.emit("emit_typing_event_server", [ obj ]);
      });
      socket.on('emit_user_online_event',function(obj){
        socket.broadcast.emit("user_online_event", [ obj ]);
      });
      socket.on('delete_message',function(message_id){
        socket.broadcast.emit("delete_message", message_id);
      });
      socket.on('message_updated',function(obj){
        socket.broadcast.emit("message_updated", obj);
      });
      
      socket.on('user_blocked',function(obj){
        socket.broadcast.emit("user_blocked", obj);
      });

      socket.on('user_unblocked',function(obj){
        socket.broadcast.emit("user_unblocked", obj);
      });
      socket.on('new_message_to_user',function(obj){
        socket.broadcast.emit("new_message_to_user",  obj );
      });
      socket.on('update_message_delivery_status',function(message_id){
          Fiber(function(){
            var fetchAllUnreadMessages = Messages.find({
              message_id: message_id,
            }).fetch();
            if(fetchAllUnreadMessages.length==1){
              Messages.update(
                { message_id: message_id },
                { $set: { delivery_status: 1 } }
              );
              socket.broadcast.emit("message_delivered",  message_id );
            }
          }).run();
      });

      socket.on('disconnect', function(obj){
        
        Fiber(function () {
          var onlineUserId = OnlineUsers.find({socket_id: socket.id}).fetch();
          if(onlineUserId.length!=0){
            socket.broadcast.emit("user_online_event", [ {user_id: onlineUserId[0].user_id, is_online: false} ]);
          }
          for(var i=0;i<onlineUserId.length;i++){
            OnlineUsers.remove({_id:onlineUserId[i]._id});
          }
       }).run();
      });
 
      socket.on("update_profile_acceptance_status", function (obj) {
        Fiber(function () {
          update_profile_acceptance_status(
            obj.message,
            obj.user_id,
            obj.message_id,
            obj.requested_from,
            obj.is_accepted,
            obj.chatroom_id,
            socket
          );
        }).run();
      });
      socket.on("emit_socket_event_block_user", function (obj) {
        socket.broadcast.emit("block_socket_event", [
          obj.chatroom_id,
          obj.blocked_user,
          obj.user_id,
        ]);
      });
      socket.on("new_message_web", function (obj) {
        Fiber(function () {
          send_message_to_other_user(
            obj.message,
            obj.chatroom_id,
            obj.user_id,
            socket,
            obj.message_type,
            undefined
          );
        }).run();
      });
      socket.on("reset_delivery_status_in_bulk",function(obj){
        Fiber(function () {
            var fetchAllUnreadMessages = Messages.find({
            chatroom_id: obj.chatroom_id,
            delivery_status: 0,
          }).fetch();
          for (var i = 0; i < fetchAllUnreadMessages.length; i++) {
            Messages.update(
              { message_id: fetchAllUnreadMessages[i].message_id },
              { $set: { delivery_status: 1 } }
            );
            socket.broadcast.emit("message_delivered",  fetchAllUnreadMessages[i].message_id );
          }
        }).run();
      });

      socket.on("clear_user_token", function (user_id) {
        Fiber(function () {
          clear_user_token(user_id);
        }).run();
      });

      socket.on(
        "new_message",
        function (new_message, chatroomId, userId, message_type, message_id) {
          Fiber(function () {
            send_message_to_other_user(
              new_message,
              chatroomId,
              userId,
              socket,
              message_type,
              message_id
            );
          }).run();
        }
      );
    });

  function update_profile_acceptance_status(
    message,
    user_id,
    message_id,
    requested_from,
    is_accepted,
    chatroom_id,
    socket
  ) {
    var check_if_user_is_online = OnlineUsers.find({
      user_id: requested_from,
      chatroom_id: chatroom_id,
    }).fetch();

    if (check_if_user_is_online.length != 0) {
      var receiverName = User.find({
        user_id: requested_from,
      }).fetch();
      if (receiverName[0]) {
        // console.log("Emitting the event for new message");
        socket.broadcast.emit("update_profile_acceptance_status", [
          message_id,
          chatroom_id,
          is_accepted,
        ]);
      }
    } else {
      var result1 = User.find({
        user_id: requested_from,
      }).fetch();
      if (result1[0]) {
        send_push_notification(chatroom_id, result1, result1[0].expertise_role, message);
      }
    }
  }

  function send_message_to_other_user(
    new_message,
    chatroom_id,
    userId,
    socket,
    message_type,
    message_id
  ) {
    var chatroomId = Chatroom.find({
      chatroom_id: chatroom_id,
    }).fetch();
    if (chatroomId.length != 0) {
      if (userId == chatroomId[0].created_by) {
        message_receiver_name = chatroomId[0].other_user_id;
      } else {
        message_receiver_name = chatroomId[0].created_by;
      }

      var check_if_user_is_online = OnlineUsers.find({
        user_id: message_receiver_name,
        chatroom_id: chatroom_id,
      }).fetch();

      if (check_if_user_is_online.length != 0) {
        var receiverName = User.find({
          user_id: message_receiver_name,
        }).fetch();
        if (receiverName[0]) {
          // console.log("Emitting the event for new message");
          socket.broadcast.emit("message_from_receiver", [
            new_message,
            chatroom_id,
            receiverName[0].name,
            receiverName[0].profile_pic,
            message_type,
            message_id
          ]);
        }
      } else {
        var result1 = User.find({
          user_id: userId,
        }).fetch();
        if (result1[0]) {
         

          var receiverName = User.find({
            user_id: message_receiver_name,
          }).fetch();
          send_push_notification(
            chatroom_id,
            receiverName,
            result1[0].expertise_role,
            new_message
          );
        }
      }
    }
  }
  function getNameFromArray(e){
    var stringWithspaces='';
    if(typeof e!='undefined' && e.length>0){
      for(i=0;i<e.length;i++){
        if(i==0){
          stringWithspaces=e[i];  
        }else{
          stringWithspaces=stringWithspaces+', '+e[i];
        }
        
      }
    }
    return stringWithspaces;
  }
  function send_push_notification(
    chatroom_id,
    message_receiver_name,
    message_sender_name,
    new_message
  ) {
    if (message_receiver_name.length != 0) {
      var message_sender_name1 = getNameFromArray(message_sender_name); 
      if (
        message_receiver_name[0].token != "" &&
        message_receiver_name[0].token != undefined
      ) {
        send_notification(
          message_receiver_name[0].token,
          new_message,
          chatroom_id,
          message_sender_name1
        );
      }

      // }
    }

    var result = ChatroomLogs.find({
      chatroom_id: chatroom_id,
      user_id: message_receiver_name[0].user_id,
    }).fetch();
    var unread_messages = 0;
    if (result[0] && result[0].unread_messages != undefined) {
      unread_messages = parseInt(result[0].unread_messages) + 1;
    } else {
      unread_messages = 1;
    }

    ChatroomLogs.update(
      {
        chatroom_id: chatroom_id,
        user_id: message_receiver_name[0].user_id,
      },
      {
        $set: {
          unread_messages: unread_messages,
          updated_at: Date.now(),
        },
      },
      function (err) {
        if (err) {
          throw err;
        }
        console.log(
          "Chatroom unread messages count updated to " + unread_messages
        );
      }
    );
  }


  async function change_user_online_status(
    user_id,
    chatroom_id,
    status,
    socket
  ) {
    var checkIfUserExists = await User.find({
      user_id: user_id,
    }).fetch();
    var result = {};
    if (checkIfUserExists.length == 1) {
      var checkIfOnline = await OnlineUsers.find({
        user_id: user_id,
      }).fetch();
      if (status) {
        if (checkIfOnline.length != 0) {
          OnlineUsers.update(
            {
              user_id: user_id,
            },
            {
              $set: {
                chatroom_id: chatroom_id,
                socket_id: socket.id
              },
            },
            {
              multi: true,
            });

          if(chatroom_id!=null){
            makeUnreadCountZero(chatroom_id, user_id);
          }
          socket.broadcast.emit("user_online_event", [ {user_id: user_id, is_online: true	 } ]);

        } else {
          OnlineUsers.insert({
            user_id: user_id,
            chatroom_id: chatroom_id,
            socket_id: socket.id,
            created_at: Date.now(),
          });
          if(chatroom_id!=null){
            makeUnreadCountZero(chatroom_id, user_id);
          }
          socket.broadcast.emit("user_online_event", [ {user_id: user_id, is_online: true	 } ]);
        }
      } else {
        // console.log("Removing From Online Users");
        for(var i=0;i<checkIfOnline.length;i++){
          OnlineUsers.remove({_id: checkIfOnline[i]._id});  
        }
        socket.broadcast.emit("user_online_event", [ {user_id: user_id, is_online: false	 } ]);
      }
    } else {
      // console.log("Invalid Params Provided");
    }
  }

  function makeUnreadCountZero(chatroom_id, user_id) {

    var result = ChatroomLogs.find({
      chatroom_id: chatroom_id,
      user_id: user_id,
    }).fetch();
    if (result[0]) {
      ChatroomLogs.update(
        {
          chatroom_log: result[0].chatroom_log,
          user_id: result[0].user_id,
        },
        {
          $set: {
            unread_messages: 0,
            updated_at: Date.now(),
          },
        },
        function (err) {
          if (err) {
            throw err;
          } else {
            console.log({
              msg: "Unread Count 0 Updated Successfully",
            });
          }
        }
      );
    }
  }
