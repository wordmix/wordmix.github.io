'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var cacheKey = 'wordfreeplay';

var LocalStorageCache = (function () {
  function LocalStorageCache() {
    _classCallCheck(this, LocalStorageCache);
  }

  LocalStorageCache.prototype.get = function get(key) {
    var item = localStorage.getItem(cacheKey + key);
    console.log('got item', item, typeof item);
    try {
      return JSON.parse(item);
    } catch (e) {
      console.log('parse error', item, typeof item);
      return item;
    }
  };

  LocalStorageCache.prototype.has = function has(key) {
    return !_.isNull(localStorage.getItem(cacheKey + key));
  };

  LocalStorageCache.prototype.set = function set(key, value) {
    if (_.isPlainObject(value)) {
      value = JSON.stringify(value);
    }
    console.log("storing", value, typeof value);
    return localStorage.setItem(cacheKey + key, value);
  };

  return LocalStorageCache;
})();

;
var cache = new LocalStorageCache();

$(document).ready(function () {
  // Clear out any pending requests.
  speechSynthesis.cancel();

  $('body').on('keypress', function (event) {
    var char = String.fromCharCode(event.which);
    var letters = /[a-z]/i;
    var isTargetAnInput = $(event.target).is("input");
    if (!isTargetAnInput && letters.test(char)) {
      focusInput();
    }
  });

  var voice;
  var lang = "en-GB";
  var form = document.querySelector('#wordForm');
  var input = document.querySelector('#wordInput');
  var attemptTemplate = _.template('\n    <div class=\'attempt animated bounceInDown <%= classes %>\'>\n      <%= mark %>\n      <%- word %>\n      <% if (!hideButtons) { %>\n      <span class="buttons">\n        <button class="btn btn-sm btn-default" data-action="pronounce" data-word="<%= word %>">\n          <i class="fa fa-volume-up" aria-hidden="true"></i> Listen\n        </button>\n        <button class="btn btn-sm btn-default" data-action="define" data-word="<%= word %>">\n          <i class="fa fa-question" aria-hidden="true"></i> Define\n        </button>\n        <button class="btn btn-sm btn-default" data-action="example" data-word="<%= word %>">\n          <i class="fa fa-quote-right" aria-hidden="true"></i> Example\n        </button>\n      </span>\n      <% } %>\n    </div>\n  ');

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var text = _.trim(input.value);
    if (text) {
      isWord(text).then(function (isWord) {
        if (isWord) {
          announceValidWord(text);
          addToValidList(text);
        } else {
          announceInvalidWord(text);
          addToInvalidList(text);
          shakeInput();
        }
        focusInput();
      });
    }
  }, true);

  function shakeInput() {
    $(input).addClass('shake').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
      $(input).removeClass('shake');
    });
  }

  function announceValidWord(word) {
    speak("You just spelled " + word + ".");
  }

  function announceInvalidWord(word) {
    if (verifySpaces(word)) {
      speak("that is not a word");
      speak("words cannot have spaces");
    } else if (verifyVowels(word)) {
      speak("that is not a word");
      speak("words must have vowels");
      speak("the orange letters are vowels");
    } else if (verifyNumbers(word)) {
      speak("that is not a word");
      speak("words cannot have numbers");
    } else if (verifyNonletters(word)) {
      speak("that is not a word");
      speak("words can only have letters");
    } else {
      speak(word + " is not a word.");
    }
  }

  var showVowels = _.once(function () {
    $(input).before("<div id='vowels'>A E I O U</div>");
  });

  function addToValidList(word) {
    $("#attempts").prepend(attemptTemplate({
      word: word,
      mark: "✓",
      "classes": "correct",
      hideButtons: false
    }));
  }

  function addToInvalidList(word) {
    $("#attempts").prepend(attemptTemplate({
      word: word,
      mark: "✗",
      "classes": "incorrect",
      hideButtons: true
    }));
  }

  function speak(word) {
    console.info("SPEAKING", word);
    if (canSpeak()) {
      speechSynthesis.cancel();
      setTimeout(function () {
        var utterance = new SpeechSynthesisUtterance();
        utterance.lang = lang;
        utterance.text = word;
        utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
      }, 25);
    }
  }

  function canSpeak() {
    return window.speechSynthesis !== undefined;
  }

  var getDefinition = function getDefinition(word) {
    var badThings = /\b(?:sex|slang|intercouse|turn on)/i;
    return makeWordRequest(word).then(function (response) {
      var best = _.find(response.results, function (result) {
        var hints = _.compact([].concat(result.usageOf, result.typeOf, result.hasTypes, result.synonyms)).join(' ');
        return !badThings.test(hints);
      });
      if (best) {
        return best.definition;
      } else {
        return undefined;
      }
    });
  };

  var getExamples = function getExamples(word) {
    return makeWordRequest(word, 'examples').then(function (response) {
      return response.examples;
    });
  };

  function verifySpaces(word) {
    var spaces = /\s/;
    return spaces.test(word);
  }
  function verifyVowels(word) {
    var vowels = /[aeiou]/i;
    return !vowels.test(word);
  }
  function verifyNumbers(word) {
    var numbers = /[0-9]/;
    return numbers.test(word);
  }
  function verifyNonletters(word) {
    var nonletters = /\W/;
    return nonletters.test(word);
  }

  function verifyWord(word) {
    if (verifySpaces(word)) {
      return false;
    } else if (verifyVowels(word)) {
      return false;
    } else if (verifyNumbers(word)) {
      return false;
    } else if (verifyNonletters(word)) {
      return false;
    } else {
      return true;
    }
  }

  function isWord(word) {
    if (verifyWord(word)) {
      return getDefinition(word).then(function () {
        return true;
      }, function () {
        // Change to true like i would with angular.
        return $.Deferred().resolve(false).promise();
      });
    } else {
      return $.Deferred().resolve(false).promise();
    }
  }

  speechSynthesis.onvoiceschanged = function () {
    // Load all voices available
    var voicesAvailable = window.speechSynthesis.getVoices();
    var langVoice = _.find(voicesAvailable, function (voice) {
      return voice.lang == lang;
    });

    if (langVoice && _.isString(langVoice.lang)) {
      voice = langVoice;
      speechSynthesis.onvoiceschanged = undefined;
    }
  };

  function focusInput() {
    input.focus();
    $(input).select();
  }

  function performWordAction(action, word) {
    if (action == "pronounce") {
      speak(word);
    } else if (action == "define") {
      defineWord(word);
    } else if (action == "example") {
      speakExample(word);
    }
  }

  function defineWord(word) {
    getDefinition(word).then(function (definition) {
      if (definition) {
        speak(definition);
      } else {
        speak("I don't know what that means");
      }
    });
  }

  var exampleCache = {};
  function speakExample(word) {
    if (!exampleCache[word]) {
      exampleCache[word] = 0;
    }
    getExamples(word).then(function (examples) {
      if (_.isEmpty(examples)) {
        speak("I can't use that in a sentence");
      } else {
        speak(examples[exampleCache[word]]);
        exampleCache[word] += 1;
        if (exampleCache[word] >= examples.length) {
          exampleCache[word] = 0;
        }
      }
    });
  }

  function makeWordRequest(word, endpoint, data) {
    var url = 'https://wordsapiv1.p.mashape.com/words/' + word;
    if (endpoint) {
      url += '/' + endpoint;
    }
    if (cache.has(url)) {
      var value = cache.get(url);
      console.log('cache hit', value, typeof value);
      if (_.isEmpty(value)) {
        return $.Deferred().reject().promise();
      } else {
        return $.Deferred().resolve(cache.get(url)).promise();
      }
    } else {
      return $.ajax({
        url: url,
        type: 'GET',
        data: data || {},
        dataType: 'json',
        beforeSend: function beforeSend(xhr) {
          xhr.setRequestHeader("X-Mashape-Authorization", "bIpQkVh6s1msht2Atln8aQS8jNUyp1Jt2FwjsnWlSJ0fkFCFJH");
        }
      }).then(function (response) {
        cache.set(url, response);
        return response;
      }, function (error) {
        cache.set(url, '');
      });
    }
  }

  $("#attempts").on("click", "button[data-action]", function () {
    var el = $(this);
    var action = el.data('action');
    var word = el.data('word');
    performWordAction(action, word);
  });
});