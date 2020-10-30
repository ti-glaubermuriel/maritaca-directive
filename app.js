(function () {

    var app = angular.module('app', []).controller('SoftPhoneCtrl', ['$scope', '$http', '$sce', function ($scope, $http, $sce) {

        var oSipStack, oSipSessionRegister, oSipSessionCall, oSipSessionTransferCall;
        var videoRemote, videoLocal, audioRemote;
        var viewVideoLocal, viewVideoRemote, viewLocalScreencast; // <video> (webrtc) or <div> (webrtc4all)
        var oConfigCall;

        // Set variable call audio
        audioRemote = document.getElementById("audio_remote");

        /*
         * **************************************************
         * *********** Init Variables  **********************
         * **************************************************
         */


        $scope.authorization = {
            token: '7btcODALxVK8JO7SWWhNilpYPhys0aZs',
            user_id_external: '5555',
            loading_login: false
        }

        $scope.agent = {
            register_status: null,
            id: null,
            name: '',
            password: null
        }

        $scope.softphone = {
            number: '',
            in_call: false,
            in_calling: false,
            loading_dialer: false,
            call_protocol: null,
            call_url: null,
            call_audio_player: null,
            agent_transfer: null
        };

        /*
         * *******************************************
         * *********** Utils Functions  **************
         * *******************************************
         */

        function startRingTone() {
            try {
                document.getElementById("audio_ringtone").volume = 0.8;
                document.getElementById("audio_ringtone").play();
            }
            catch (e) {
            }
        }

        function stopRingTone() {
            try {
                document.getElementById("audio_ringtone").pause();
                document.getElementById("audio_ringtone").currentTime = 0;
            }
            catch (e) {
            }
        }


        // Templates Status Softphone

        function softphoneStatusInit() {

            if ($scope.softphone.in_call) {
                setTimeout(function () {
                    $scope.findCallRecording();
                }, 1000);
            }

            $scope.softphone.loading_dialer = false;
            $scope.softphone.in_calling = false;
            $scope.softphone.in_call = false;
            $scope.$applyAsync();
        }

        function softphoneStatusIncall() {
            $scope.softphone.loading_dialer = false;
            $scope.softphone.in_calling = false;
            $scope.softphone.in_call = true;
            $scope.$applyAsync();
            setTimeout(function () {
                $scope.findProtocol();
            }, 1000);
        }

        function softphoneStatusInCalling() {
            $scope.softphone.loading_dialer = false;
            $scope.softphone.in_calling = true;
            $scope.softphone.in_call = false;
            $scope.$applyAsync();
        }

        function softphoneStatusLoading() {
            $scope.softphone.loading_dialer = true;
            $scope.softphone.in_calling = false;
            $scope.softphone.in_call = false;
            $scope.$applyAsync();
        }



        function setRegister(status) {
            $scope.agent.register_status = status;

        }


        function setSoftphoneNumero(number) {
            $scope.softphone.number = number;
            $scope.$applyAsync();
        }

        function registerCall(description) {
            var Div = document.getElementById("lista_registros");
            Div.innerHTML += `<samp>${description}</samp><br/>`;
        }

        function eventsCall(description) {
            var Div = document.getElementById("lista_eventos");
            Div.innerHTML += `<samp>${description}</samp><br/>`;
        }

        function clearInitCall() {
            var Div = document.getElementById("lista_eventos");
            Div.innerHTML = '';

            // clear scope last call
            $scope.softphone.call_protocol = null;
            $scope.softphone.call_url = '';
            $scope.$applyAsync();
        }

        $scope.get_html = function (x) {
            if (!x)
                return $sce.trustAsHtml('');
            return $sce.trustAsHtml(x);
        };


        $scope.findProtocol = function () {
            try {
                if ($scope.agent.id && $scope.softphone.in_call) {

                    $http({
                        method: 'GET',
                        url: "https://maritaca.noip.me/api/integra/chamada-online/" + $scope.agent.id,
                        params: {},
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }).then(function successCallback(response) {

                        if (response.data) {
                            if (response.data.uniqueid !== null) {
                                $scope.softphone.call_protocol = response.data.uniqueid;
                                $scope.$applyAsync();
                            }
                        }

                    }, function errorCallback(data) {
                        eventsCall('Falha ao buscar protocolo')
                        return;
                    });

                }
                else {
                    eventsCall('Falha ao buscar protocolo')
                }
            } catch (error) {
                eventsCall('Erro ao buscar protocolo: ' + error)
            }
        };



        $scope.findCallRecording = function () {
            try {
                if ($scope.softphone.call_protocol) {

                    $http({
                        method: 'GET',
                        url: "https://maritaca.noip.me/api/integra/busca-chamada/" + $scope.softphone.call_protocol,
                        params: {},
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }).then(function successCallback(response) {

                        if (response.data) {
                            if (response.data.uniqueid !== null) {
                                $scope.softphone.call_url = response.data.url_ligacao;
                                $scope.softphone.call_audio_player = '<audio controls style="width: 100%"><source src="' + response.data.url_ligacao + '" type="audio/mpeg">Seu navegador não possuir suporte para ouvir áudio!</audio>';
                                $scope.$applyAsync();
                            }
                        }

                    }, function errorCallback(data) {
                        eventsCall('Falha ao buscar gravacao')
                        return;
                    });

                }
                else {
                    eventsCall('Falha ao buscar gravacao')
                }
            } catch (error) {
                eventsCall('Erro ao buscar gravacao: ' + error)
            }
        };

        /*
         * *****************************************
         * ***********  SIP Actions ****************
         * *****************************************
         */


        function sipInit() {
            // attachs video displays
            if (SIPml.isWebRtc4AllSupported()) {

                viewVideoLocal = videoLocal;
                viewVideoRemote = videoRemote;
                viewLocalScreencast = null;
                WebRtc4all_SetDisplays(viewVideoLocal, viewVideoRemote, viewLocalScreencast);
            }
            else {

                viewVideoLocal = videoLocal;
                viewVideoRemote = videoRemote;
            }

            return;
        }


        $scope.loginIntegra = function () {

            if (!$scope.authorization.token || !$scope.authorization.user_id_external) {
                registerCall('Dados de acesso inválidos');
                return false;
            }

            $scope.authorization.loading_login = true;

            $http({
                method: 'POST',
                url: "https://maritaca.noip.me/api/login-integra/" + $scope.authorization.user_id_external,
                data: {},
                headers: { 'maritaca-token': $scope.authorization.token }
            }).then(function successCallback(response) {

                if (response.data.type == 'success') {
                    $scope.agent.id = response.data.agente.id;
                    $scope.agent.name = response.data.agente.nome;
                    $scope.agent.password = response.data.agente.token;
                    $scope.$applyAsync();

                    sipRegister();
                }
                else {
                    registerCall('Falha ao realizar Login: ' + response.data.message);
                }

                $scope.authorization.loading_login = false;

            }, function errorCallback(data) {
                $scope.authorization.loading_login = false;
                registerCall('Falha ao realizar Login: ' + data.message)
                return;
            });

        }

        function sipRegister() {

            if (!$scope.agent.id || !$scope.agent.password) {
                registerCall('Falha ao realizar Login');
                return false;
            }

            try {

                // SIPml.setDebugLevel("error");
                // define dados de sessao
                oConfigCall = {
                    audio_remote: audioRemote,
                    video_local: null,
                    video_remote: null,
                    screencast_window_id: 0x00000000, // entire desktop
                    bandwidth: { audio: undefined, video: undefined },
                    video_size: { minWidth: undefined, minHeight: undefined, maxWidth: undefined, maxHeight: undefined },
                    events_listener: { events: '*', listener: onSipEventSession },
                    sip_caps: [
                        { name: '+g.oma.sip-im' },
                        { name: 'language', value: '\"en,fr\"' }
                    ]
                };

                // define dados de registro
                oSipStack = new SIPml.Stack({
                    realm: "maritaca.noip.me",
                    impi: $scope.agent.id.toString(),
                    impu: `sip:${$scope.agent.id.toString()}@maritaca.noip.me`,
                    password: $scope.agent.password.toString(),
                    display_name: $scope.agent.name.toString(),
                    websocket_proxy_url: "wss://maritaca.noip.me:8089/ws",
                    outbound_proxy_url: null,
                    ice_servers: null,
                    enable_rtcweb_breaker: true,
                    events_listener: { events: '*', listener: onSipEventStack },
                    enable_early_ims: true, // Must be true unless you're using a real IMS network
                    enable_media_stream_cache: true,
                    bandwidth: null, // could be redefined a session-level
                    video_size: null, // could be redefined a session-level
                    sip_headers: [
                        { name: 'User-Agent', value: 'maritaca.me / VS 0.1-beta' },
                        { name: 'Organization', value: 'Maritaca.me' }
                    ]
                }
                );

                if (oSipStack.start() !== 0) {
                    registerCall('Falha ao logar: Acesso Inválido');
                    setRegister(false);
                }
                else {
                    registerCall('Agente Logado com sucesso!');
                    setRegister(true);
                }

            }
            catch (e) {
                registerCall('Error ao logar: ' + e);
                setRegister(false);
            }

        }

        // shutdown register agent SIP
        $scope.logoutIntegra = function () {

            if (oSipStack) {
                $scope.authorization.loading_login = true;

                $http({
                    method: 'POST',
                    url: "https://maritaca.noip.me/api/logout-integra",
                    data: {},
                }).then(function successCallback(response) {

                    if (response.data.type == 'success') {
                        oSipStack.stop();
                        setRegister(false);
                        registerCall('Agente Deslogado!');

                        clearInitCall();
                    }
                    else {
                        registerCall('Falha ao realizar Logout: ' + response.data.message);
                    }

                    $scope.authorization.loading_login = false;

                }, function errorCallback(data) {
                    $scope.authorization.loading_login = false;
                    registerCall('Falha ao realizar Logout: ' + data.message)
                    return;
                });
            }
        }


        // Realiza chamada
        $scope.sipCall = function () {

            if (oSipStack && !oSipSessionCall && !tsk_string_is_null_or_empty($scope.softphone.number)) {

                if ($scope.softphone.number.length >= 10) {

                    // cria nova sessao de ligação
                    oSipSessionCall = oSipStack.newSession('call-audio', oConfigCall);
                    softphoneStatusLoading(); // Set Template status softphone

                    $http({
                        method: 'GET',
                        url: "https://maritaca.noip.me/api/integra/verifica-saldo",
                        params: {},
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }).then(function successCallback(response) {

                        if (response.data.type == 'success') {
                            if (oSipSessionCall.call('0' + $scope.softphone.number) !== 0) {
                                oSipSessionCall = null;
                                eventsCall('Falha na ligação');
                                softphoneStatusInit(); // Set Template status softphone
                                return;
                            }
                            else {
                                clearInitCall();
                            }
                        }
                        else {
                            oSipSessionCall = null;
                            eventsCall('Saldo de minutos insuficiente');
                            softphoneStatusInit(); // Set Template status softphone
                            return;
                        }


                    }, function errorCallback(data) {
                        oSipSessionCall = null;
                        eventsCall('Falha na ligação');
                        softphoneStatusInit(); // Set Template status softphone
                        return;
                    });

                }
                else {
                    oSipSessionCall = null;
                    eventsCall('Número Inválido');
                    return;
                }
            }
            // ########### RECEPTIVO ##################
            else if (oSipSessionCall && $scope.softphone.in_calling) {
                softphoneStatusLoading(); // Set Template status softphone
                oSipSessionCall.accept(oConfigCall);
                softphoneStatusIncall(); // Set Template status softphone

                // $scope.softphone.data = moment().format('DD/MM/YYYY HH:mm');
            }

        };


        // transfers the call
        function sipTransfer() {
            if (oSipSessionCall) {
                //btnTransfer.disabled = true;
                if (oSipSessionCall.transfer(scope.softphone.agent_transfer) !== 0) {
                    txtCallStatus.innerHTML = '<i>Call transfer failed</i>';
                    eventsCall('Falha ao transferir');
                    return;
                }
                else {
                    eventsCall('Transferindo ligação...');
                }
            }
        }

        // holds or resumes the call
        $scope.sipToggleHoldResume = function () {
            if (oSipSessionCall) {
                var i_ret;
                i_ret = oSipSessionCall.bHeld ? oSipSessionCall.resume() : oSipSessionCall.hold();
                if (i_ret !== 0) {
                    return;
                }
            }
        };

        // Mute or Unmute the call
        $scope.sipToggleMute = function () {
            if (oSipSessionCall) {
                var i_ret;
                var bMute = !oSipSessionCall.bMute;

                i_ret = oSipSessionCall.mute('audio'/*could be 'video'*/, bMute);
                if (i_ret !== 0) {
                    return;
                }

                oSipSessionCall.bMute = bMute;

                if (bMute) {
                    eventsCall('Ligação em mute');
                }
                else {
                    eventsCall('Ligação sem mute');
                }
            }
        };

        $scope.sipHangUp = function () {

            if (oSipSessionCall && !$scope.softphone.in_calling) {
                eventsCall('Terminando Ligação...');
                oSipSessionCall.hangup({ events_listener: { events: '*', listener: onSipEventSession } });
                softphoneStatusInit(); // Set Template status softphone
            }
            else if (oSipSessionCall && $scope.softphone.in_calling) {
                eventsCall('Ligação Rejeitada');
                oSipSessionCall.reject();
                softphoneStatusInit(); // Set Template status softphone
            }
        };

        function sipSendDTMF(c) {
            if (oSipSessionCall && c) {
                if (oSipSessionCall.dtmf(c) === 0) {
                    try {
                        eventsCall('Dígito: ' + c);
                        dtmfTone.play();
                    } catch (e) {
                    }
                }
            }
        }


        /*
        * ****************************************
        * ***********  SIP Register Events ****************
        * ****************************************
        */

        function onSipEventStack(e) {

            try {
                tsk_utils_log_info('==stack event = ' + e.type);
                var homeLoader;
                switch (e.type) {
                    case 'started':
                        {
                            try {
                                oSipSessionRegister = this.newSession('register', {
                                    expires: 1,
                                    events_listener: { events: '*', listener: onSipEventSession },
                                    sip_caps: [
                                        { name: '+g.oma.sip-im', value: null },
                                        { name: '+audio', value: null },
                                        { name: 'language', value: '\"en,fr\"' }
                                    ]
                                });
                                oSipSessionRegister.register();
                            }
                            catch (e) {
                                registerCall('Falha ao logar: started');
                                setRegister(false);
                            }
                            break;
                        }
                    case 'stopping':
                    case 'stopped':
                        oSipStack = null;
                        oSipSessionRegister = null;
                        oSipSessionCall = null;
                        stopRingTone();
                        break;
                    case 'failed_to_start':
                    case 'failed_to_stop':
                        {
                            var bFailure = (e.type == 'failed_to_start') || (e.type == 'failed_to_stop');
                            oSipStack = null;
                            oSipSessionRegister = null;
                            oSipSessionCall = null;
                            stopRingTone();
                            softphoneStatusInit();

                            break;
                        }
                    case 'i_new_call':
                        {
                            if (oSipSessionCall) {
                                e.newSession.hangup();
                            }
                            else {
                                oSipSessionCall = e.newSession;
                                oSipSessionCall.setConfiguration(oConfigCall);

                                var sRemoteNumber = (oSipSessionCall.getRemoteFriendlyName() || ''); // Numero da chamada receptiva

                                setSoftphoneNumero(sRemoteNumber);
                                startRingTone();
                                softphoneStatusInCalling();
                                eventsCall('Ligação Receptiva Chamando ...');

                            }
                            break;
                        }

                    case 'm_permission_requested':
                        {
                            break;
                        }
                    case 'm_permission_accepted':
                        {
                            break;
                        }
                    case 'm_permission_refused':
                        {
                            break;
                        }
                    case 'starting': {
                        break;
                    }
                    default:
                        break;
                }
            }
            catch (e) {
                oSipStack = null;
                oSipSessionRegister = null;
                oSipSessionCall = null;
                stopRingTone();

                registerCall('Error ao logar');

            }
        }


        function onSipEventSession(e) {
            try {

                //tsk_utils_log_info('==session event = ' + e.type);

                switch (e.type) {
                    case 'connecting':
                        {
                            if (e.session == oSipSessionCall) {
                                softphoneStatusLoading();
                            }

                            break;
                        }
                    case 'connected':
                        {
                            if (e.session == oSipSessionRegister) {
                            }
                            else if (e.session == oSipSessionCall) {
                                stopRingTone();
                                softphoneStatusIncall();
                                eventsCall('Em ligação');

                            }
                            break;
                        } // 'connecting' | 'connected'
                    case 'terminating':
                    case 'terminated':
                        {
                            if (e.session == oSipSessionRegister) {

                                oSipSessionCall = null;
                                oSipSessionRegister = null;
                                stopRingTone();
                            }
                            else if (e.session == oSipSessionCall) {
                                oSipSessionCall = null;
                                stopRingTone();
                                softphoneStatusInit();
                                eventsCall('Ligação Finalizada');
                            }
                            break;
                        } // 'terminating' | 'terminated'

                    case 'm_stream_video_local_added':
                        {
                            break;
                        }
                    case 'm_stream_video_local_removed':
                        {
                            break;
                        }
                    case 'm_stream_video_remote_added':
                        {
                            break;
                        }
                    case 'm_stream_video_remote_removed':
                        {
                            break;
                        }

                    case 'm_stream_audio_local_added':
                    case 'm_stream_audio_local_removed':
                    case 'm_stream_audio_remote_added':
                    case 'm_stream_audio_remote_removed':
                        {

                            break;
                        }

                    case 'i_ect_new_call':
                        {
                            oSipSessionTransferCall = e.session;
                            break;
                        }

                    case 'i_ao_request':
                        {
                            if (e.session == oSipSessionCall) {
                                var iSipResponseCode = e.getSipResponseCode();
                                if (iSipResponseCode == 180 || iSipResponseCode == 183) {
                                    softphoneStatusIncall();
                                    eventsCall('Processando ligação...');
                                }
                            }
                            break;
                        }

                    case 'm_early_media':
                        {
                            if (e.session == oSipSessionCall) {
                                stopRingTone();
                            }
                            break;
                        }

                    case 'm_local_hold_ok':
                        {
                            if (e.session == oSipSessionCall) {
                                if (oSipSessionCall.bTransfering) {
                                    oSipSessionCall.bTransfering = false;
                                }
                                eventsCall('Ligação em Espera');
                                oSipSessionCall.bHeld = true;
                            }
                            break;
                        }
                    case 'm_local_hold_nok':
                        {
                            if (e.session == oSipSessionCall) {
                                oSipSessionCall.bTransfering = false;
                            }
                            break;
                        }
                    case 'm_local_resume_ok':
                        {
                            if (e.session == oSipSessionCall) {
                                oSipSessionCall.bTransfering = false;
                                eventsCall('Ligação fora da espera');
                                oSipSessionCall.bHeld = false;
                            }
                            break;
                        }
                    case 'm_local_resume_nok':
                        {
                            if (e.session == oSipSessionCall) {
                                oSipSessionCall.bTransfering = false;
                            }
                            break;
                        }
                    case 'm_remote_hold':
                        {
                            if (e.session == oSipSessionCall) {
                                eventsCall('Ligação em Espera');
                            }
                            break;
                        }
                    case 'm_remote_resume':
                        {
                            if (e.session == oSipSessionCall) {
                                eventsCall('Ligação fora da espera');
                            }
                            break;
                        }
                    case 'm_bfcp_info':
                        {
                            if (e.session == oSipSessionCall) {
                            }
                            break;
                        }

                    case 'o_ect_trying':
                        {
                            if (e.session == oSipSessionCall) {
                                eventsCall('Transferindo ...');
                            }
                            break;
                        }
                    case 'o_ect_accepted':
                        {
                            if (e.session == oSipSessionCall) {
                                eventsCall('Transferência realizada');

                                setTimeout(function () {
                                    if (oSipSessionCall) {
                                        eventsCall('Ligação realizada');
                                        oSipSessionTransferCall = null;
                                        oSipSessionCall.hangup({ events_listener: { events: '*', listener: onSipEventSession } });
                                        softphoneStatusInit()
                                    }
                                }, 1000);

                            }
                            break;
                        }
                    case 'o_ect_completed':
                    case 'i_ect_completed':
                        {
                            if (e.session == oSipSessionCall) {
                                eventsCall('Transferência realizada');
                                if (oSipSessionTransferCall) {
                                    oSipSessionCall = oSipSessionTransferCall;
                                }
                                oSipSessionTransferCall = null;
                            }
                            break;
                        }
                    case 'o_ect_failed':
                    case 'i_ect_failed':
                        {
                            if (e.session == oSipSessionCall) {
                                eventsCall('Falha na transferência');
                                setTimeout(function () {
                                    if (!oSipSessionCall) {
                                        softphoneStatusIncall();
                                    }
                                }, 2500);
                            }
                            break;
                        }
                    case 'o_ect_notify':
                    case 'i_ect_notify':
                        {
                            if (e.session == oSipSessionCall) {
                                ///txtCallStatus.innerHTML = "<i>Call Transfer: <b>" + e.getSipResponseCode() + " " + e.description + "</b></i>";
                                if (e.getSipResponseCode() >= 300) {
                                    if (oSipSessionCall.bHeld) {
                                        oSipSessionCall.resume();
                                    }
                                }
                            }
                            break;
                        }
                    case 'i_ect_requested':
                        {
                            eventsCall('Transferência solicitada');
                            if (e.session == oSipSessionCall) {
                                var s_message = "Do you accept call transfer to [" + e.getTransferDestinationFriendlyName() + "]?";
                                if (confirm(s_message)) {
                                    eventsCall('Transferência aceita');
                                    oSipSessionCall.acceptTransfer();
                                    break;
                                }
                                eventsCall('Transferência rejeitada');
                                oSipSessionCall.rejectTransfer();
                            }
                            break;
                        }
                }

            }
            catch (err) {
                oSipSessionCall = null;
                stopRingTone();
                softphoneStatusInit();
                eventsCall('Error: ' + err);
                eventsCall('Event: ' + e.description);
            }

        }




        /*
        * ****************************************
        * ***********  SIP INIT ******************
        * ****************************************
        */

        SIPml.init(sipInit);

    }]).directive('softphone', function () {
        return {
            restrict: 'E',
            templateUrl: 'softphone.html',
            controller: 'SoftPhoneCtrl',
            link: function ($scope, element, attrs) {

            }
        };
    });

}());