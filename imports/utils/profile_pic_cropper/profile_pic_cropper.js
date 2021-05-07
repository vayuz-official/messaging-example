import { Utils } from "./../../../utils/utils.js";
import { PopupUtils } from "./../../../utils/PopupUtils.js";
import { UserPojo } from "./../../../pojo/admin/userPojo.js";
import { CityAndProvience } from "./../../../collections/collection";
import { CityAndProvience_Nonreactive } from "./../../../collections/collection.js";
import { HTTP } from "meteor/http";
import { RegisterationNetwork } from "../../../network/itg/regiteration-network/registeration-network.js";
import Cropper from "cropperjs";

import { ErrorMessages } from "./../../../utils/ErrorMessages.js";
import { AvatarNetwork } from "../../../network/itg/avatar-network/avatar-network.js";
import './profile_pic_cropper.html';

const axios = require("axios").default;
var blobObj = "";
var isUrl = false;
function loadLibrariesWithException() {
  try {
    $.getScript("/frontend-assets/js/app.js", function () {
      $.getScript("/frontend-assets/js/profile.js", function () {
        console.log("Lib Loaded");
      });
    });
  } catch (e) {
    console.log(e);
    setTimeout(function () {
      loadLibrariesWithException();
    }, 1000);
  }
}
Template.profile_pic_cropper.onRendered(async function () {
  loadLibrariesWithException();
});

Template.profile_pic_cropper.helpers({
  is_ready: function () {
    return Session.get("isReady");
  },
});
Template.profile_pic_cropper.events({
 
  "click .upload-button": function (event) {
    $("#upload-crop-profile-modal").addClass("is-active");
  },
  "click #remove_profile_image": function (event) {
    event.preventDefault();
    $("#upload-preview").attr(
      "src",
      "/frontend-assets/images/default-user.png"
    );
    $("#remove_profile_image").addClass("display_hidden");
  },

  "click #submit-profile-picture": function (event) {
    event.preventDefault();
  
      $("#loader").removeClass("display_hidden");
      if (!requestSent) {
        upload_image();
      }
  },
  "click .close-wrap": function (event) {
    event.preventDefault();
    $("#upload-crop-profile-modal").removeClass("is-active");
  },
  "click .modal-background": function (event) {
    event.preventDefault();
    $("#upload-crop-profile-modal").removeClass("is-active");
  },
//   'click #submit-profile-picture':function(event){
//     event.preventDefault();
//     isUrl = false;
//   }
});

var requestSent = false;

function upload_image(img) {
	if($("#upload-preview").attr("src") == "/frontend-assets/images/default-user.png"){
		$("#upload-preview").attr("src",Meteor.absoluteUrl() + "frontend-assets/images/default-user.png");
    }else{
      if(requestSent == false){
        blobObj = Utils.dataURItoBlob($("#upload-preview").attr("src"));
        var form = new FormData();
        form.append("files", blobObj);
        requestSent = true;
        var settings = {
          async: true,
          crossDomain: true,
          url: "/upload_files_content",
          method: "POST",
          headers: {
            "cache-control": "no-cache",
            "postman-token": "7b3b1271-07c8-2c13-4bd2-ee8ef740bf5f",
          },
          processData: false,
          contentType: false,
          mimeType: "multipart/form-data",
          data: form,
        };
        Session.set("check_if_uploading_going_on",true);
        $.ajax(settings).done(function (response) {
          response = JSON.parse(response);
          Session.set("check_if_uploading_going_on",false);
          if (response.s3_url) {
			$("#upload-preview").attr("src",Utils.getS3Suffix() + response.s3_url);
            $("#remove_profile_image").removeClass("display_hidden");
          }
        });
      }
      
    }
  
}