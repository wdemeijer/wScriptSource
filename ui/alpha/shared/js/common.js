var globalHandlers = {};
var model = {};
var global_mod_list = [];
var scene_mod_list = [];
var messageLog = {};
var app = {};

function loadScript(src) {
    console.log(src, "loading script");
    var o = new XMLHttpRequest();
    try
    {
        o.open('GET', src, false);
        o.send('');
    }
    catch( err )
    {
        console.log("error loading " + src)
        return;
    }
	var se = document.createElement('script');
    se.type = "text/javascript";
    se.text = o.responseText;
    document.getElementsByTagName('head')[0].appendChild(se);
}

function loadModScript(src) {
    console.log(src, "loading script");
    var o = new XMLHttpRequest();
    try
    {
        o.open('GET', src, false);
        o.send('');
    }
    catch( err )
    {
        console.log("error loading " + src)
        return;
    }
   
	var script   = document.createElement("script");
	script.type  = "text/javascript";
	script.src   = src;    // use this for linked script
	document.getElementsByTagName('head')[0].appendChild(script);
}

function loadCSS(src) {
    console.log(src, "loading css");
    var link = document.createElement('link');
    link.href = src;
    link.type = "text/css";
    link.rel = "stylesheet";
    document.getElementsByTagName("head")[0].appendChild(link);
}

function loadMods(list) {
    var i;
    var mod;
    var type;

    var js = /[.]js$/;
    var css = /[.]css$/;

    init_browser();

    for (i = 0; i < list.length; i++) {
        mod = list[i];

        if (mod.match(js))
            loadModScript(mod);

        if (mod.match(css))
            loadCSS(mod);
    }
}

// usage: embedHtmlWithScript( "foo.html", "#container", "$('#dest') );
//
// Load the 'container' helement from foo.html and appends it to $('#dest').
// Also will ensure that top level script tags in foo.html are executed
//
function embedHtmlWithScript(srcHtml, srcSelector, target, cb) {
    target.load(srcHtml+" "+srcSelector, function() {
        $.get(srcHtml, function(data) {
            $(data).filter("script").each( function(i, script) {
                //console.log(script.src, "loading");
                loadScript(script.src);
            });
            cb();
        });
    });
}

// loc() - primary localization function
//   loc("!LOC(id):original text") -> i18n(id)              // !LOCSKIP this comment is so the loc update script knows to skip this line
//       id found -> translated text (yay!)
//       id not found -> id (uh oh! make the sure id is in the translation json files)
//       original text is ignored at this point (but will be used when you run the loc update script, so keep it intact)
//   loc("!LOC:original text") -> "RUNLOCSCRIPT! " + original text                 // !LOCSKIP this comment is so the loc update script knows to skip this line
//       should only show up if you've marked string for loc (good!) but haven't run the loc update script to generate ids (do it!)
//   loc(any_other_string) -> any_other_string
//       any string without a loc tag is a passthrough, so loc(loc(loc(text))) should equal loc(text)
function loc(inText, inOptionalArgs) {
    var locTag = "!LOC"; // !LOCSKIP
    if (inText.substring(0, locTag.length) === locTag) {
        if (inText.charAt(locTag.length) === '(') {
            var remainingText = inText.substring(locTag.length + 1);
            var endParen = remainingText.indexOf(')');
            if (endParen >= 0) {
                var locId = remainingText.substring(0, endParen);
                try {
                    return i18n.t(locId, inOptionalArgs);
                } catch (error) { return "LOCEXCEPTION!"; }
            } else {
                return remainingText;
            }
        } else if (inText.charAt(locTag.length) === ':') {
            return "RUNLOCSCRIPT! " + inText.substring(locTag.length + 1);
        }
    }
    return inText;
}

function locAddNamespace(ns) {
    i18n.loadNamespace(ns, function() {});
}

function locUpdateDocument() {
    $('loc').i18n();
    $('*[locattr]').each(function(i) {
        var locAttrText = $(this).attr("locattr");
        var attrs = locAttrText.split(";");
        for (iAttr in attrs) {
            $(this).attr(attrs[iAttr], loc($(this).attr(attrs[iAttr])));
        }
    });
}

function locInitInternal(localeString) {
    locNamespace = location.pathname.substr(0,location.pathname.lastIndexOf("."));
    locNamespace = locNamespace.substr(locNamespace.lastIndexOf('/')+1);
    $.i18n.init({
        lng: localeString,
        lowerCaseLng: true,
        resGetPath: '../_i18n/locales/__lng__/__ns__.json',
        ns: { namespaces: [locNamespace
            , 'shared'
            //, 'put_any_other_common_namespaces_here'
            ],
            defaultNs: locNamespace},
        useLocalStorage: false,
        debug: true,
        getAsync: false // ###chargrove $TODO $PERF had to do this to ensure i18n.t() availability in later initialization; making all translation async-friendly is beyond the scope of my JS skills in the time I have available (a JS ninja may have refactoring ideas though).
    }, function() {
        // release the hold established during locInit()
        $.holdReady(false);
    });
}

function locInit() {
    // delay the ready event until this is done (we need loc available during initialization)
    $.holdReady(true);

    // uses gEngineParams.locale value configured internally by engine at startup.  We do this instead
    // of an engine call in this case because of latency concerns; much of the page load is blocked on
    // on loc data load, and engine calls are tied to the client render loop, so a delay there could
    // be problematic.
    if (typeof gEngineParams !== 'undefined' && typeof gEngineParams.locale !== 'undefined') {
        locInitInternal(gEngineParams.locale);
    } else {
        console.log("ERROR locInit: gEngineParams.locale value undefined; using engine call as a fallback");
        engine.call('loc.getCurrentLocale').then(function (data) {
            locInitInternal(data);
        });
    }
}

loadCSS("../shared/css/boot.css");
loadScript("../shared/js/boot.js");

loadScript("../shared/js/catalog.js");
function getCatalogItem(item) {
    var result = $.grep(baseCatalog, function (e) { return e.ObjectName == item; });
    if (result.length == 0) {
        return null;
    }
    else if (result.length > 1) {
        console.log("Catalog error -duplicate item " + JSON.stringify(result[0]));
        return null;
    }
    else {
        return result[0];
    }
}


locInit();

loadScript("../../mods/ui_mod_list.js");

if (global_mod_list)
    loadMods(global_mod_list);

function encode(object) {
    return JSON.stringify(object);
}

function legacyDecode(string)
{
    if (!string)
        return null;

    var index = string.indexOf(':');
    var type = string.slice(0, index);
    var value = string.slice(index + 1);

    try {
        switch (type) {
            case 'null': return null;
            case 'string': return String(value);
            case 'number': return Number(value);
            case 'boolean': return value === "true";
            case 'object': return JSON.parse(value);
            case 'undefined': return undefined;
            case 'function': return undefined;
        }
    }
    catch (error) { return null; }
}

function decode(string) {
    try {
        return JSON.parse(string);
    } catch (error) {
        return legacyDecode(string);
    }
}

function cleanupLegacyStorage() {
    for (var key in localStorage) 
        localStorage[key] = encode(decode(localStorage[key]));
}

function getMountedMods(callback) {
    engine.call('mods.getMountedMods').then(function (data) {
        var message;
        try {
            message = JSON.parse(data);
        } catch (e)
        {
            console.log("getMountedMods: JSON parsing error");
            console.log(data);
            message = {};
        }
        if (message.mounted_mods !== undefined) {
            callback(message.mounted_mods);
        } else {
            console.log("getMountedMods: mounted_mods is undefined");
        }
    });
    return null;
}

function testDumpLoadedMods() {
    console.log("MODINFO: ok checking...");
    getMountedMods(function (mod_array) {
        console.log("MODINFO: got mounted mod callback, mod count is " + mod_array.length);
        for (var mod in mod_array) {
            console.log("Mod " + mod + ": " + JSON.stringify(mod_array[mod]));
        }
    });
}

ko.extenders.local = function (target, option) {
    var v;

    // write changes to storage
    target.subscribe(function (newValue) {
        localStorage[option] = encode(newValue);
    });

    // init from storage
    if (localStorage[option]) {
        v = decode(localStorage[option]);
        target(v);
    }

    return target;
};

ko.extenders.session = function (target, option) {

    var v;

    // write changes to storage
    target.subscribe(function (newValue) {
        sessionStorage[option] = encode(newValue);
    });

    // init from storage
    if (sessionStorage[option]) {
        v = decode(sessionStorage[option]);
        target(v);
    }

    return target;
};

ko.extenders.notify = function (target, option) {
    // write changes to storage
    target.subscribe(function (newValue) {
        console.log(option+':'+newValue);
    });

    return target;
};


ko.extenders.notifyWithMessage = function (target, option) {

    target.subscribe(function (newValue) {

        if(messageLog[option] === newValue)
            return;

        messageLog[option] = newValue;

        var m = {};
        //console.log("target " + target() + " newvalue " + newValue);
        m.payload = newValue;

        m.message_type = option;

        //console.log(m);
        engine.call("conn_send_message", JSON.stringify(m));
    });

    return target;
};

(function () { 
    // add useful binding handlers to knockout
    
    ko.bindingHandlers.resize = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            valueAccessor()(); // invoke the bound fn once on init 
            UberUtility.addResizeListener(element, valueAccessor()); // invoke the bound fn on each resize
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // do nothing on update
        }
    };

    ko.bindingHandlers.overflow = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            valueAccessor()(); // invoke the bound fn once on init 
            UberUtility.addFlowListener(element, 'over', valueAccessor()); // invoke the bound fn overflow, 
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // do nothing on update
        }
    };

    ko.bindingHandlers.underflow = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            valueAccessor()(); // invoke the bound fn once on init 
            UberUtility.addFlowListener(element, 'under', valueAccessor()); // invoke the bound fn underflow, 
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // do nothing on update
        }
    };

    ko.bindingHandlers.observeAttributes = {

        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            valueAccessor()(); // invoke the bound fn once on init 

            var observer = new WebKitMutationObserver(function (mutations) {
                valueAccessor()(); // invoke the bound fn wheneve a property of the element *is written to* 
                // if you overwrite an existing value with the same value this will still trigger
            });

            observer.observe(element, { attributes: true, subtree: false });
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // do nothing on update
        }
    };

    ko.bindingHandlers.observeLocalAttributes = {

        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            valueAccessor()(); // invoke the bound fn once on init 

            var observer = new WebKitMutationObserver(function (mutations) {
                valueAccessor()(); // invoke the bound fn whenever a property of the element *is written to* 
                // if you overwrite an existing value with the same value this will still trigger
            });

            var i;
            for (i = 0; i < element.parentElement.children.length; i++)
                observer.observe(element.parentElement.children[i], { attributes: true, subtree: false });

            //observer.observe(element, { attributes: true, subtree: false });
            observer.observe(element.parentElement, { attributes: true, subtree: false });
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // do nothing on update
        }
    };

    ko.bindingHandlers.click_sound = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var value = ko.utils.unwrapObservable(valueAccessor());
            if (value === 'default')
                value = '/SE/UI/UI_Click';

            $(element).click(function () {
                api.audio.playSound(value);
            });
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) { /* do nothing on update */ }
    }

    ko.bindingHandlers.rollover_sound = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
       
            var value = ko.utils.unwrapObservable(valueAccessor());
            if (value === 'default')
                value = '/SE/UI/UI_Rollover';

            $(element).mouseenter(function () { api.audio.playSound(value) });
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) { /* do nothing on update */ }
    }

    var last_rollover_group = null;

    /* rollover sounds don't work correctly when the element is recreated in response to a mouse event.
       the rollover sound plays once each time the element is created (assuming the mouse is over the element).
       this binding prevents that behavior by squelching rollover sounds if they come from the same group. */
    ko.bindingHandlers.rollover_sound_exclusive = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {

            $(element).mouseenter(function () {

                if (valueAccessor().group !== last_rollover_group) {
                    api.audio.playSound((valueAccessor().sound === 'default') ? '/SE/UI/UI_Rollover' : valueAccessor().sound);
                    last_rollover_group = valueAccessor().group;
                }
            });

            $(element).mouseout(function () { last_rollover_group = null });
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) { /* do nothing on update */ }
    }

    ko.extenders.withPrevious = function (target) {
        // Define new properties for previous value and whether it's changed
        target.previous = ko.observable();
        target.changed = ko.computed(function () { return target() !== target.previous(); });

        // Subscribe to observable to update previous, before change.
        target.subscribe(function (v) {
            target.previous(v);
        }, null, 'beforeChange');

        // Return modified observable
        return target;
    }

    ko.bindingHandlers.selectPicker = {
        init: function (element, valueAccessor, allBindingsAccessor) {
            if ($(element).is('select')) {
                if (ko.isObservable(valueAccessor())) {
                    ko.bindingHandlers.value.init(element, valueAccessor, allBindingsAccessor);
                }
                $(element).selectpicker();
            }
        },
        update: function (element, valueAccessor, allBindingsAccessor) {
            if ($(element).is('select')) {
                var selectPickerOptions = allBindingsAccessor().selectPickerOptions;
                if (typeof selectPickerOptions !== 'undefined' && selectPickerOptions !== null) {
                    var options = selectPickerOptions.options,
                        optionsText = selectPickerOptions.optionsText,
                        optionsValue = selectPickerOptions.optionsValue,
                        optionsCaption = selectPickerOptions.optionsCaption;
                    if (ko.utils.unwrapObservable(options).length > 0) {
                        ko.bindingHandlers.options.update(element, options, ko.observable({ optionsText: optionsText, optionsValue: optionsValue, optionsCaption: optionsCaption }));
                    }
                }
                if (ko.isObservable(valueAccessor())) {
                    ko.bindingHandlers.value.update(element, valueAccessor);
                }
                $(element).selectpicker('refresh');
            }
        }
    };

})();




app.registerWithCoherent = function (model, handlers) {

    var response_key = Math.floor(Math.random() * 65536);
    var responses = {};
    globalHandlers.response = function(msg) {
        if (!msg.hasOwnProperty('key'))
            return;
        var key = msg.key;
        delete msg.key;
        if (!responses[key])
            return;

        var respond = responses[key];
        delete responses[key];
        respond(msg.status === 'success', msg.result);
    };
    
    function read_message(message, payload) {
        if (handlers[message]) {
            //console.log('handling:' + message);
            handlers[message](payload);
        }
        else if (globalHandlers[message]) {
            globalHandlers[message](payload);
        } 
        else
            console.log('unhandled msg:' + message);
    }

    function process_message(string) {
        var message;
        try {
            message = JSON.parse(string);
        } catch (e) {
            console.log('process_message: JSON parsing error');
            console.log(string);
            return;
        }

        var payload = message.payload;
        if (!payload) {
            payload = _.clone(message);
            delete payload.message_type;
        }
        read_message(message.message_type, payload);
    }
    engine.on("process_message", process_message);

    function process_signal(string) {

        read_message(string, {});
    }
    engine.on("process_signal", process_signal);



    var async_requests = {};

    engine.asyncCall = function (/* ... */) {
        // console.log('in engine.asyncCall');
        // console.log(arguments);
        var request = new $.Deferred();
        engine.call.apply(engine, arguments).then(
            function (tag) {
                // console.log('in engine.asyncCall .then handler, tag=', tag);
                async_requests[tag] = request;
            }
        );
        return request.promise();
    };

    function async_result(tag, success /* , ... */) {
        var request, args;
        // console.log('in async_result');
        // console.log(arguments);
        request = async_requests[tag];
        delete async_requests[tag];
        if (request) {
            args = Array.slice(arguments, 2, arguments.length);
            if (success) {
                request.resolve.apply(request, args);
            } else {
                request.reject.apply(request, args);
            }
        }
    }
    engine.on("async_result", async_result);


    model.send_message = function (message, payload, respond) {

        var m = {};
        if (payload)
            m.payload = payload;

        m.message_type = message;
        if (respond)
        {
            m.response_key = ++response_key;
            responses[m.response_key] = respond;
        }

        engine.call("conn_send_message", JSON.stringify(m));
    }

    model.disconnect = function () {
        engine.call("reset_game_state");
    }

    model.exit = function () {
        engine.call("exit");
    }

    app.hello = function(succeed, fail) {
        model.send_message('hello', {}, function(success, response) {
            if (success)
                succeed(response);
            else
                fail(response);
        });
    };
    
    api.Panel.ready(_.keys(handlers).concat(_.keys(globalHandlers)));
};

$(document).ready(function() {
    // disable middle mouse scrolling
    $('body').mousedown(function (e) { if (e.button === 1) return false; });

    if (api.Panel.pageId === 0)
    {
        Mousetrap.bind('`', function() { gameConsole.toggle(); });
        //Mousetrap.bind('f5', function () { api.game.debug.reloadScene(); });

        apply_keybinds('general');
        apply_keybinds('debugging');
    }

    locUpdateDocument();

    // now that loc has been updated, it's okay to show the page
    $('html').fadeIn(0).show();
});
