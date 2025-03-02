'use strict';

(() => {

const Connection = __ble_mx_api.ConnectionExt;

const str2Uint8Array = __ble_mx_api.str2Uint8Array;
const DataView2str   = __ble_mx_api.DataView2str;
const str_csum       = __ble_mx_api.str_csum;
const CSUM_LEN       = __ble_mx_api.CSUM_LEN;
const COMPRESS_TAG   = __ble_mx_api.COMPRESS_TAG;
const compress       = __ble_mx_api.compress;
const decompress     = __ble_mx_api.decompress;

const status = document.getElementById('status');
const bt_btn = document.getElementById('bt-btn');
const cmd_arg = [
	document.getElementById('cmd-arg1'),
	document.getElementById('cmd-arg2'),
	document.getElementById('cmd-arg3')
]
const txt_res   = document.getElementById('txt-res');
const sel_cmd   = document.getElementById('select-cmd');
const sel_log   = document.getElementById('select-log');
const cmd_empty = document.getElementById('opt-select-cmd-empty');
const log_empty = document.getElementById('opt-select-log-empty');

const empty_cmd_text = '--command--';
const empty_log_text = '--log file--';

const ncmd_args = cmd_arg.length;

let bt_conn = null;

const commands = {
	'uptime' : {
		'name' : 'Running time'
	},
	'reboot' : {
		'name' : 'Reboot'
	},
	'shutdown' : {
		'name' : 'Shutdown'
	},
	'release' : {
		'name' : 'Code release'
	},
	'mk_pins' : {
		'name' : 'Create PINs',
		'args': ['passphrase']
	},
	'rm_pins' : {
		'name' : 'Remove PINs'
	},
	'log_tail' : {
		'name' : 'Show log',
		// The first argument is the log filename.
		// It should be selected from the drop down list.
		'args': ['number of lines']
	},
	'copy_logs' : {
		'name' : 'Copy logs'
	},
	'top' : {
		'name' : 'Top processes',
		'args': ['the number of process', 'more top options']
	},
	'wifi' : {
		'name' : 'Connect / forget WiFi',
		'args': [
			'network name / leave empty to forget',
			'network password / leave empty to forget'
		]
	},
	'eth_addr' : {
		'name' : 'Set Ethernet IP address',
		'args': [
			'static IP/mask / empty for dynamic IP',
			'router IP / empty for dynamic IP',
			'DNS addresses / empty for dynamic IP'
		]
	},
	'ifconfig' : {
		'name' : 'Network configuration'
	}
};

let cmd_list;
let log_list;

function initPage()
{
	if (!navigator.bluetooth) {
		document.body.innerHTML = '<div class="alert-page">The Bluetooth is not supported in this browser. Please try another one.</div>';
		return;
	}
	status.textContent = 'not connected';
	cmd_empty.textContent = empty_cmd_text;
	bt_btn.textContent = 'Connect';
	bt_btn.onclick = onBtn;
	bt_conn = new Connection(rx_cb, true);
	sel_cmd.addEventListener('change', on_cmd_selected);
	sel_log.addEventListener('change', on_log_selected);
}

function onBTConnected(device)
{
	status.textContent = 'connected';
	status.classList.remove('failed');
	status.classList.add('connected');
	bt_btn.textContent = 'Execute';
	if (!cmd_list)
		send_cmd('_ls_cmd');
	else if (!log_list)
		send_cmd('_ls_log');
	else
		init_cmd_selector();
}

function doSendCmd()
{
	const cmd = sel_cmd.value;
	if (!cmd) {
		console.error('command not selected');
		return;
	}
	const descr = commands[cmd];
	if ('args' in descr)
	{
		let args = [];
		const nargs = descr['args'].length;
		if (cmd == 'log_tail') {
			if (!sel_log.selectedIndex) {
				console.error('log file not selected');
				return;
			}
			args.push(sel_log.value);
		}
		for (let i = 0; i < nargs; ++i) {
			const arg = cmd_arg[i].value;
			if (!arg)
				break;
			args.push(arg);
		}
		send_cmd(cmd, args);
	} else
		send_cmd(cmd);

	txt_res.textContent = '';
	txt_res.disabled = true;
}

function onDisconnection(device)
{
	status.textContent = 'reconnecting ..';
	status.classList.add('failed');
	status.classList.remove('connected');
	bt_btn.disabled = true;
	sel_cmd.disabled = true;
	sel_log.disabled = true;
	for (let i = 0; i < ncmd_args; ++i)
		cmd_arg[i].disabled = true;
	txt_res.disabled = true;
	connectTo(device);
}

function cmd_ok()
{
	return sel_cmd.selectedIndex != 0 && (sel_cmd.value != 'log_tail' || sel_log.selectedIndex != 0);
}

function init_cmd_selector()
{
	const cmd = sel_cmd.value;
	const descr = commands[cmd];
	const nargs = descr && 'args' in descr ? descr['args'].length : 0;
	for (let i = 0; i < nargs; ++i)
		cmd_arg[i].disabled = false;
	sel_cmd.disabled = false;
	sel_log.disabled = (cmd != 'log_tail');
	bt_btn.disabled = !cmd_ok();
}

function on_cmd_selected()
{
	const cmd = sel_cmd.value;
	const descr = commands[cmd];
	const nargs = descr && 'args' in descr ? descr['args'].length : 0;
	for (let i = 0; i < nargs; ++i) {
		cmd_arg[i].placeholder = descr['args'][i];
		cmd_arg[i].disabled = false;
	}
	for (let i = nargs; i < ncmd_args; ++i) {
		cmd_arg[i].placeholder = '';
		cmd_arg[i].disabled = true;
	}
	if (cmd == 'log_tail') {
		log_empty.textContent = empty_log_text;
		sel_log.disabled = false;
	} else {
		log_empty.textContent = '';
		sel_log.disabled = true;
	}
	sel_log.selectedIndex = 0;
	bt_btn.disabled = !cmd_ok();
}

function on_log_selected()
{
	bt_btn.disabled = !cmd_ok();
}

function setup_commands(arr)
{
	console.log('commands:', arr);
	for (const cmd in commands) {
		if (!arr.includes(cmd)) {
			console.log('unsupported command:', cmd);
			delete commands[cmd];
		}
	}
	for (const cmd of arr) {
		if (!cmd || cmd[0] == '_')
			continue;
		if (!(cmd in commands)) {
			console.log('unknown command added:', cmd);
			commands[cmd] = {'name' : cmd, 'args' : Array(ncmd_args).fill('')};
		}
	}
	for (const cmd in commands) {
		var opt = document.createElement('option');
		opt.value = cmd;
		opt.innerHTML = commands[cmd].name;
		sel_cmd.appendChild(opt);		
	}
	cmd_list = arr;
}

function setup_logs(arr)
{
	console.log('logs:', arr);
	for (const f of arr) {
		if (f) {
			var opt = document.createElement('option');
			opt.value = f;
			opt.innerHTML = f;
			sel_log.appendChild(opt);
		}
	}
	log_list = arr;
}

function handle_cmd_list(o)
{
	if (o['ret'] !== 0) {
		console.warn('unexpected _ls_cmd return code');
		return;
	}
	if (!cmd_list)
		setup_commands(o['out'].split('\n'));
	if (!log_list)
		send_cmd('_ls_log');
}

function handle_log_list(o)
{
	if (o['ret'] !== 0) {
		console.warn('unexpected _ls_log return code');
		return;
	}
	if (!log_list) {
		setup_logs(o['out'].split('\n'));
		if (bt_conn.is_connected())
			init_cmd_selector();
	}
}

function handle_cmd_resp(o)
{
	let str = '';
	if (o['out'])
		str += o['out'];
	if (o['err'])
		str += o['err'];
	txt_res.textContent = str;
	if (o['ret'])
		txt_res.classList.add('failed');
	else
		txt_res.classList.remove('failed');
	txt_res.disabled = false;
}

function send_cmd(cmd, args)
{
	let o = {'cmd' : cmd};
	if (args)
		o['args'] = args;
	send_cmd_obj(o);
}

function send_cmd_obj(o)
{
	const str = JSON.stringify(o);
	return txString('C' + str.slice(1, -1));
}

function handle_msg_str(str)
{
	if (str[0] != 'C') {
		console.warn('unexpected message type');
		return;
	}
	handle_msg_obj(JSON.parse('{' + str.slice(1) + '}'));
}

function handle_msg_obj(o)
{
	const cmd = o['cmd'];
	switch (cmd) {
	case '_ls_cmd':
		handle_cmd_list(o);
		break;
	case '_ls_log':
		handle_log_list(o);
		break;
	default:
		handle_cmd_resp(o);
		break;
	}
}

function do_receive(data)
{
	let str = DataView2str(data);
	console.debug('rx:', str);
	if (str.slice(-CSUM_LEN) != str_csum(str, str.length - CSUM_LEN)) {
		console.error('bad csum:', str);
		return;
	}
	handle_msg_str(str.slice(0, -CSUM_LEN));
}

function rx_cb(data, is_binary=false)
{
	const len = data.byteLength;
	if (data.getUint8(len - 1) != COMPRESS_TAG) {
		do_receive(data);
		return;
	}
	decompress(new DataView(data.buffer, 0, len - 1)).then(d => {
		console.log('unzip:', len - 1, '->', d.byteLength);
		do_receive(d);
	})
	.catch((err) => {console.error('failed to decompress', err);});
}

function connectTo(device)
{
	bt_conn.connect(device, onBTConnected, onDisconnection);
}

function doConnect(devname)
{
	status.textContent = 'connecting ..';
	console.log('doConnect', devname);
	bt_btn.disabled = true;
	let filters = [{services: [Connection.bt_svc_id]}];
	if (devname) {
		filters.push({name: devname});
	}
	return navigator.bluetooth.requestDevice({
		filters: filters,
	}).
	then((device) => {
		console.log(device.name, 'selected');
		connectTo(device);
	})
	.catch((err) => {
		console.error('Failed to discover BT devices');
		bt_btn.textContent = 'Connect';
		bt_btn.disabled = false;
	});
}

function txString(str)
{
	str += str_csum(str);
	console.log('tx:', str);
	bt_conn.write(str2Uint8Array(str));
}

function onBtn(event)
{
	if (bt_conn.is_connected())
		doSendCmd();
	else
		doConnect();
}

initPage();

})();

