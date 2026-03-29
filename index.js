const Alexa = require('ask-sdk-core');

const WEEKLY_SCHEDULE = {
    monday: ['umido'],
    tuesday: ['carta e cartone'],
    wednesday: ['plastica'],
    thursday: ['secco'],
    friday: ['vetro e lattine'],
    saturday: [],
    sunday: []
};

const DAY_LABELS = {
    monday: 'lunedì',
    tuesday: 'martedì',
    wednesday: 'mercoledì',
    thursday: 'giovedì',
    friday: 'venerdì',
    saturday: 'sabato',
    sunday: 'domenica'
};

const JS_DAY_TO_KEY = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
];

const MATERIAL_SYNONYMS = {
    'umido': 'umido',
    'organico': 'umido',

    'carta': 'carta e cartone',
    'cartone': 'carta e cartone',
    'carta e cartone': 'carta e cartone',

    'plastica': 'plastica',

    'secco': 'secco',
    'rsu': 'secco',
    'indifferenziato': 'secco',
    'secco rsu': 'secco',

    'vetro': 'vetro e lattine',
    'lattine': 'vetro e lattine',
    'metalli': 'vetro e lattine',
    'vetro e metalli': 'vetro e lattine',
    'vetro e lattine': 'vetro e lattine'
};

// Eccezioni annuali.
// Nota: la struttura è pronta per essere completata con tutte le eccezioni del PDF.
const DATE_OVERRIDES = {
    '2026-01-01': [],
    '2026-01-02': ['umido'],
    '2026-01-03': ['plastica'],
    '2026-01-05': ['umido', 'carta e cartone'],

    '2026-04-06': [],
    '2026-04-07': ['umido'],
    '2026-04-08': ['secco'],
    '2026-04-09': ['plastica'],
    '2026-04-10': ['umido'],

    '2026-05-01': [],
    '2026-05-02': ['vetro e lattine', 'umido'],

    '2026-06-02': ['secco'],

    '2026-12-08': [],
    '2026-12-09': ['umido'],
    '2026-12-10': ['plastica'],
    '2026-12-11': ['umido'],

    '2026-12-25': [],
    '2026-12-26': [],
    '2027-01-01': [],
    '2027-01-06': []
};

const ECOCENTRO_HOURS = [
    'lunedì dalle 9 e 30 alle 12 e 30',
    'martedì dalle 9 e 30 alle 12 e 30',
    'mercoledì dalle 9 e 30 alle 12 e 30 e dalle 15 alle 18',
    'giovedì dalle 9 e 30 alle 12 e 30',
    'venerdì dalle 9 e 30 alle 12 e 30 e dalle 15 alle 18',
    'sabato dalle 9 e 30 alle 12 e 30'
];

const BULKY_INFO = {
    phone: '800 615 622',
    hours: 'dal lunedì al venerdì dalle 8 e 30 alle 17 e 30, e il sabato dalle 8 alle 12'
};

function normalizeMaterial(value) {
    if (!value) {
        return null;
    }

    const key = value.toLowerCase().trim();
    return MATERIAL_SYNONYMS[key] || null;
}

function pad2(num) {
    return String(num).padStart(2, '0');
}

function toIsoDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getDateForOffset(offsetDays = 0) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);
    return date;
}

function getDayKeyFromDate(date) {
    return JS_DAY_TO_KEY[date.getDay()];
}

function formatMaterials(materials) {
    if (!materials || materials.length === 0) {
        return null;
    }

    if (materials.length === 1) {
        return materials[0];
    }

    if (materials.length === 2) {
        return `${materials[0]} e ${materials[1]}`;
    }

    return `${materials.slice(0, -1).join(', ')} e ${materials[materials.length - 1]}`;
}

function formatDateItalian(date) {
    return date.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
}

function getCollectionForDate(date) {
    const iso = toIsoDate(date);

    if (Object.prototype.hasOwnProperty.call(DATE_OVERRIDES, iso)) {
        return DATE_OVERRIDES[iso];
    }

    const dayKey = getDayKeyFromDate(date);
    return WEEKLY_SCHEDULE[dayKey] || [];
}

function getCollectionByNamedDay(dayKey) {
    return WEEKLY_SCHEDULE[dayKey] || [];
}

function buildCollectionSpeechForDate(date, prefixText) {
    const materials = getCollectionForDate(date);
    const formatted = formatMaterials(materials);

    if (!formatted) {
        return `${prefixText} non è prevista alcuna raccolta a Gonnosfanadiga.`;
    }

    return `${prefixText} è prevista la raccolta di ${formatted}. Ricorda di esporre il rifiuto dalle 22 del giorno precedente fino alle 5 del giorno di raccolta.`;
}

function buildCollectionSpeechForDayKey(dayKey) {
    const materials = getCollectionByNamedDay(dayKey);
    const formatted = formatMaterials(materials);
    const dayLabel = DAY_LABELS[dayKey];

    if (!formatted) {
        return `Per ${dayLabel} non è prevista alcuna raccolta a Gonnosfanadiga, salvo eventuali eccezioni del calendario annuale.`;
    }

    return `Per ${dayLabel} è prevista la raccolta di ${formatted}, salvo eventuali eccezioni del calendario annuale.`;
}

function alexaDayToInternal(dayValue) {
    if (!dayValue) {
        return null;
    }

    const v = dayValue.toLowerCase().trim();

    const map = {
        'monday': 'monday',
        'tuesday': 'tuesday',
        'wednesday': 'wednesday',
        'thursday': 'thursday',
        'friday': 'friday',
        'saturday': 'saturday',
        'sunday': 'sunday',
        'lunedì': 'monday',
        'lunedi': 'monday',
        'martedì': 'tuesday',
        'martedi': 'tuesday',
        'mercoledì': 'wednesday',
        'mercoledi': 'wednesday',
        'giovedì': 'thursday',
        'giovedi': 'thursday',
        'venerdì': 'friday',
        'venerdi': 'friday',
        'sabato': 'saturday',
        'domenica': 'sunday'
    };

    return map[v] || null;
}

function getNextCollectionForMaterial(material) {
    const normalized = normalizeMaterial(material);

    if (!normalized) {
        return null;
    }

    for (let offset = 0; offset < 30; offset++) {
        const date = getDateForOffset(offset);
        const materials = getCollectionForDate(date);

        if (materials.includes(normalized)) {
            return {
                material: normalized,
                date,
                offset
            };
        }
    }

    return null;
}

function buildWhenText(offset, date) {
    if (offset === 0) {
        return 'oggi';
    }

    if (offset === 1) {
        return 'domani';
    }

    return formatDateItalian(date);
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speechText = 'Benvenuto in Raccolta rifiuti Gonnosfanadiga. Puoi chiedermi cosa si ritira oggi, domani, quando passa la plastica, gli orari dell ecocentro oppure come funziona il ritiro ingombranti.';

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt('Ad esempio, puoi dire: cosa si ritira oggi?')
            .getResponse();
    }
};

const GetCollectionTodayIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetCollectionTodayIntent';
    },
    handle(handlerInput) {
        const speechText = buildCollectionSpeechForDate(getDateForOffset(0), 'Oggi');

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const GetCollectionTomorrowIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetCollectionTomorrowIntent';
    },
    handle(handlerInput) {
        const speechText = buildCollectionSpeechForDate(getDateForOffset(1), 'Domani');

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const GetCollectionByDayIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetCollectionByDayIntent';
    },
    handle(handlerInput) {
        const slotValue = Alexa.getSlotValue(handlerInput.requestEnvelope, 'day');
        const dayKey = alexaDayToInternal(slotValue);

        let speechText;

        if (!dayKey) {
            speechText = 'Non ho capito il giorno richiesto. Prova a dire, ad esempio, cosa si ritira martedì.';
        } else {
            speechText = buildCollectionSpeechForDayKey(dayKey);
        }

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const GetNextCollectionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetNextCollectionIntent';
    },
    handle(handlerInput) {
        const slotValue = Alexa.getSlotValue(handlerInput.requestEnvelope, 'material');
        const normalizedMaterial = normalizeMaterial(slotValue);

        if (!normalizedMaterial) {
            return handlerInput.responseBuilder
                .speak('Dimmi il tipo di rifiuto. Ad esempio: quando passa la plastica?')
                .reprompt('Puoi dire: quando passa l umido?')
                .getResponse();
        }

        const nextCollection = getNextCollectionForMaterial(normalizedMaterial);

        if (!nextCollection) {
            return handlerInput.responseBuilder
                .speak(`Non ho trovato un prossimo giorno di raccolta per ${normalizedMaterial}.`)
                .getResponse();
        }

        const whenText = buildWhenText(nextCollection.offset, nextCollection.date);
        const speechText = `La prossima raccolta di ${normalizedMaterial} è ${whenText}. Ricorda di esporre il rifiuto dalle 22 del giorno precedente.`;

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const GetEveningReminderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetEveningReminderIntent';
    },
    handle(handlerInput) {
        const tomorrow = getDateForOffset(1);
        const materials = getCollectionForDate(tomorrow);
        const formatted = formatMaterials(materials);

        const speechText = !formatted
            ? 'Stasera non devi esporre alcun rifiuto, perché domani non è prevista raccolta.'
            : `Stasera devi esporre ${formatted}, perché domani è prevista la raccolta. Ricorda che il conferimento va fatto dalle 22 in poi.`;

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const GetEcocentroHoursIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetEcocentroHoursIntent';
    },
    handle(handlerInput) {
        const speechText = `L ecocentro comunale di Gonnosfanadiga è aperto ${ECOCENTRO_HOURS.join(', ')}.`;

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const GetBulkyInfoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetBulkyInfoIntent';
    },
    handle(handlerInput) {
        const speechText = `Per il ritiro ingombranti puoi chiamare il numero verde ${BULKY_INFO.phone}. Il servizio di prenotazione è disponibile ${BULKY_INFO.hours}. Il materiale deve essere davanti al numero civico, facilmente maneggiabile, privo di parti taglienti o sporgenti, con un massimo di 3 pezzi.`;

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const GetDiapersInfoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetDiapersInfoIntent';
    },
    handle(handlerInput) {
        const speechText = 'La raccolta di pannolini e pannoloni è dedicata agli utenti che ne fanno richiesta presso l ufficio tecnico o l ufficio protocollo del comune di Gonnosfanadiga. Le giornate di raccolta sono il martedì e il venerdì.';

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const GetGreenWasteInfoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetGreenWasteInfoIntent';
    },
    handle(handlerInput) {
        const speechText = 'La raccolta degli sfalci verdi, come potature e ramaglie, avviene il primo venerdì del mese a domicilio.';

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = 'Puoi chiedermi cosa si ritira oggi, cosa si ritira domani, quando passa la plastica, gli orari dell ecocentro, oppure il numero per il ritiro ingombranti.';

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt('Prova a dire: cosa si ritira oggi?')
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (
                Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent'
            );
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('A presto.')
            .getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speechText = 'Non ho capito. Puoi chiedermi cosa si ritira oggi, domani, gli orari dell ecocentro, oppure come funziona il ritiro ingombranti.';

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt('Ad esempio, puoi dire: cosa si ritira domani?')
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Errore gestito: ${error.message}`);

        return handlerInput.responseBuilder
            .speak('Si è verificato un problema. Riprova tra poco.')
            .reprompt('Puoi chiedermi cosa si ritira oggi.')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        GetCollectionTodayIntentHandler,
        GetCollectionTomorrowIntentHandler,
        GetCollectionByDayIntentHandler,
        GetNextCollectionIntentHandler,
        GetEveningReminderIntentHandler,
        GetEcocentroHoursIntentHandler,
        GetBulkyInfoIntentHandler,
        GetDiapersInfoIntentHandler,
        GetGreenWasteInfoIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
