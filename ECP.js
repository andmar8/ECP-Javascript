/*   Copyright 2014 Andrew Martin, Newcastle University

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/


/*
 * Notes:
 * - There is no SSL certificate validity checking, this probably can/is done in other languages
 * - In other languages I've implemented this in (c#.net, java, objective c) it is easier to do something
 * like XSLT transforms on the xml that gets sent/returned, but in javascript I found it just as easy to do
 * string manipulation using indexOfs, slices and replaces.
 * - This is not written in pure javascript and makes use of the jquery library's ajax() function, it probably
 * could be written in pure javascript, if you wanted to go further with jquery you could use it's XML parsing
 * features to replace the string manipulation code.
 * - You can pull out the service provider and identity provider URLs from the XML returned at various points
 * to make your client more robust, but generally these URLs shouldn't change much if you are just retrieveing
 * a specific resource for a limited purpose, i.e. shib attributes for a user. This code does not parse out
 * those URLS and is simply hardcoded in the code we use in production.
 */

/* This is the first call in the three step process that requests the protected resource */
$.ajax({type:"GET",url:"https://......",/* This has to be the url of the protected resource you are trying to retrieve */
    /* Setting the header here in this fashion is the magic sprinkle that tells the server "I am making an ECP request" */
	headers:{"Accept":"text/html; application/vnd.paos+xml","PAOS":"ver=\"urn:liberty:paos:2003-08\";\"urn:oasis:names:tc:SAML:2.0:profiles:SSO:ecp\""},
	/* The response could be HTML,XML,JSON... anything really, I'm trying to get at JSON */
	dataType:"text"})
.done(function(data,statusText,jqXHR){

	var jsonFound = false;/* No error == bad*/
	try{$.parseJSON(data);jsonFound=true;}catch(err){} /** Or this could all just be in a try/catch instead of using an error state bool **/
	/* We should NOT be seeing json at this point as that would mean there is already a session, it should be an XML response from the Service Provider */
	if(!jsonFound){
		var headerStart = data.indexOf("<S:Header>");
		var headerEnd = data.indexOf("</S:Header>");
		var header = data.slice(headerStart,headerEnd+11); /* Get the header */
		var rsStart = header.indexOf("<ecp:RelayState");
		var rsEnd = header.indexOf("</ecp:RelayState>");
		var relayState = header.slice(rsStart,rsEnd+17); /* Get the relay state */
		var samlResponseWithoutHeaderPrefix = data.slice(0,headerStart);
		var samlResponseWithoutHeaderPostfix = data.slice(headerEnd+11);
		var idpRequest = samlResponseWithoutHeaderPrefix+samlResponseWithoutHeaderPostfix; /* Form an xml doc without the header sent to you */
		var base64UserPwd = btoa(username+":"+pswd); /* base64 encode the user:pass combination for BASIC AUTH */

		/* This step passes the xml doc you just formed to the SHIB/ECP identity provider server and authenticates the required user
		 * using BASIC AUTH, the most common fail state here is a 401 (see below), on success you will get an XML doc with certificate
		 * and to show your service provider you are authenticated.
		 * It is a good idea to put a timeout on this request as in some javascript engines, providing a bad user/pass combination
		 * just results in the ajax function stalling.
		 */
		$.ajax({type:"POST",url:"https://....",
			headers:{"Authorization":"Basic "+base64UserPwd},
			dataType:"text",data:idpRequest,timeout:20000})
		.done(function(idpResponse,statusText,jqXHR){
			var relayStateNSAdjusted = relayState.replace(/S:/g,"soap11:"); /* adjust the xml namespace slightly on the relay state */
			var idpResponseHeaderStart = idpResponse.indexOf("<soap11:Header>");
			var idpResponseWithoutHeaderContentPrefix = idpResponse.slice(0,idpResponseHeaderStart+15);
			var idpResponseHeaderEnd = idpResponse.indexOf("</soap11:Header>");
			var idpResponseWithoutHeaderContentPostfix = idpResponse.slice(idpResponseHeaderEnd);
			/* Snip out the header from this response and replace it with the namespace adjusted relay state from the very first response */
			var spPackage = idpResponseWithoutHeaderContentPrefix+relayStateNSAdjusted+idpResponseWithoutHeaderContentPostfix;

			/* This is the final step, you have now requested the resource you want and authenticated against the identity provider, all you
			 * need to do now is tell the ECP service provider on the server that holds the requested resource "I am authenticated, please give
			 * me the resource I requested". You will also receive a session cookie so further requests needn't go through this process for the
			 * duration of the cookie's lifespan (after that point you will have to require the user to relogin or do it for the user by holding
			 * on to their credentials somewhere reasonably safe).
			 */
			$.ajax({type:"POST",url:"https://....",
				/* Note the content type setting, this DOES make the difference of the request working or not */
				contentType:"application/vnd.paos+xml",dataType:"text",data:spPackage})
			.done(function(protectedResource,statusText,jqXHR){
					var json JSON.parse(protectedResource); /* the json var now === the protected resource (in this case json) as a parsed object */
			})
			.fail(function(jqXHR,status,error){
				/* A fail here "can" occur if you are not properly logged out, to counter this you must revoke the cookies
				 * but make the "server" revoke the cookies by iniating a shib logout (as the server will have set this cookie),
				 * in most instances this will not happen as once you have logged in you will be setting the cookie yourself
				 * for subsequent sessions. One example of this fail is to login, logout without revoking the server set cookie,
				 * then login again; if you were to login, kill the client session, start a new session, set the cookie yourself this
				 * error WILL NOT occur.
				 *
				 * On logout always remember to revoke cookies by deleting the ones you set and doing a SHIB side logout
				 */
			});
		})
		.fail(function(jqXHR,status,error){
			/*
			 * At this point a fail is most likely a HTTP 401 "unauthorized"
			 * (i.e. the user got their password wrong) which you can check
			 * using the returned fail params
			 */
		});
	}else{ /* This can happen if the webview is still logged in for some reason... */
		/* Revoke the session cookie/webcache to esolve this problem */
	}
})
.fail(function(jqXHR,status,error){
	/*
	 * If you already have a session (cookie) at this point it should just return the resource,
	 * if this is not what you want (i.e. you want to login another user), log the user out here
	 * by revoking the session cookie
	 */
});