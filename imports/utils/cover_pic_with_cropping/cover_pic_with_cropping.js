import { ImageUtilsNetwork } from '../../../network/image_utils/ImageUtilsNetwork.js';
import {
	PopupUtils
} from './../../../utils/PopupUtils.js'
import {
	Utils
} from './../../../utils/utils.js';
import './cover_pic_with_cropping.html';
var timer = 0;
let uploadedDocumentType = ['jpg', 'png', 'jpeg'];
function loadLibrariesWithException(){
	 try{
	  $.getScript("https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.js",function(){
		$.getScript("/frontend-assets/js/profile.js",function(){
		  console.log("Lib Loaded");
		}); 
	  });
	}catch(e){

	  setTimeout(function(){
		loadLibrariesWithException();
	  },1000)
	}  
}
Template.cover_pic_with_cropping.onRendered(function(){
	loadLibrariesWithException();
})
Template.cover_pic_with_cropping.onDestroyed(function(){
// clearInterval(timer);
})
Template.cover_pic_with_cropping.events({
	"click .cover-edit": function (event) {
		event.preventDefault();
		$("#change-cover-modal").addClass("is-active")
	  },
	 "click .modal-background":function(event){
		  event.preventDefault();
		 $("#change-cover-modal").removeClass("is-active");  
	  },
		"click .close-modal": function (event) {
		event.preventDefault();
		$("#change-cover-modal").removeClass("is-active")
	
	  },
	  "click #submit-cover-picture": function (event) {
		event.preventDefault();
		setTimeout(function () {
		  if ($("#change-cover-modal").hasClass("is-active")) {
			$("#change-cover-modal").removeClass("is-active")
		  }
		  var coverSrc = Session.get("croppedImageSrc");
		  var form = new FormData();
		  form.append("files", Utils.dataURItoBlob(coverSrc));
		  $(".cover-image").attr("src", coverSrc);
		  Session.set("check_if_uploading_going_on",true);
		  var settings = {
			"async": true,
			"crossDomain": true,
			"url": "/upload_files_content",
			"method": "POST",
			"headers": {
			  "cache-control": "no-cache",
			  "postman-token": "7b3b1271-07c8-2c13-4bd2-ee8ef740bf5f"
			},
			"processData": false,
			"contentType": false,
			"mimeType": "multipart/form-data",
			"data": form
		  }
	
		  $.ajax(settings).done(function (response) {
			console.log(response);
			Session.set("check_if_uploading_going_on",false);
			response = JSON.parse(response);
			$(".cover-image").attr("src", Utils.getS3Suffix() + response.s3_url);
		  });
		}, 1000);
	  },
})


