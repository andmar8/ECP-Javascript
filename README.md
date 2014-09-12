ECP-Javascript
==============

An implementation of ECP in javascript

---

The intent of this repository is merely to show the method (in javascript) to successfully return a SHIB-ECP protected "resource", it does not cover the overall lifecycle of the authenticated session, which can be achieved using (or something akin to) to jquery cookie plugin:

$.cookie - http://plugins.jquery.com/cookie/

It is also important to note that (as far as I'm aware) javascript does not do any of the heavy weight ssl certificate checking to make sure the certificate being used is valid. I *think* there *may* be projects out there that do this...

---

The method to retrieve an ECP protected resource can be fully explored here:

https://wiki.shibboleth.net/confluence/display/SHIB2/ECP

...and a brief explanation of BASIC AUTH can be found here:

http://en.wikipedia.org/wiki/Basic_access_authentication

...but in essence it is this:

* Ask for the resource you want using a method that says "this is an ECP request"
* Take the response and form a request to send to the identity provider using BASIC AUTH and the required user's username/password base64'ed combination
* Take the response (now including a certificate) from the identity provider and re-format it for sending to the service provider
* The response from the service provider will be the resource originally requested in the first step