/* Shared by the UI and the browser tests. No fuzzy or substring matching. */
window.LedProtocol = (() => {
  const commands = new Map([
    ['左邊開燈', 'BLUE_ON'], ['左边开灯', 'BLUE_ON'], ['藍燈開啟', 'BLUE_ON'],
    ['右邊開燈', 'GREEN_ON'], ['右边开灯', 'GREEN_ON'], ['綠燈開啟', 'GREEN_ON'],
    ['左邊關燈', 'BLUE_OFF'], ['左边关灯', 'BLUE_OFF'],
    ['右邊關燈', 'GREEN_OFF'], ['右边关灯', 'GREEN_OFF'],
    ['全部關燈', 'ALL_OFF'], ['全部关灯', 'ALL_OFF'],
    ['閃爍三次', 'BLINK_THREE'], ['闪烁三次', 'BLINK_THREE']
  ]);
  function recognize(text) {
    const normalized = text.trim().replace(/\s+/g, '').replace(/[。.!！?？,，、]+$/u, '');
    return commands.get(normalized) || null;
  }
  function parseReply(line) {
    const match = /^V1 ([0-9]{1,10}) (OK|ERROR) AMB82-MINI ([01]) ([01])$/.exec(line.trim());
    return match ? { id: match[1], ok: match[2] === 'OK', blue: match[3] === '1', green: match[4] === '1' } : null;
  }
  function matches(command, state) {
    return ({ STATUS: true, BLUE_ON: state.blue, GREEN_ON: state.green,
      BLUE_OFF: !state.blue, GREEN_OFF: !state.green,
      ALL_OFF: !state.blue && !state.green,
      BLINK_THREE: !state.blue && !state.green })[command] === true;
  }
  return { recognize, parseReply, matches };
})();
