/**
 * Every guest-facing string lives here, Chinese first.
 *
 * A full i18n library would cost more bundle than it earns for two languages
 * and a few dozen keys, so this is a plain lookup. Keys are dot-namespaced by
 * screen. Content that the couple edits (programme, bingo prompts) is NOT here
 * — that is bilingual in the database via _zh / _en column pairs.
 */
export const strings = {
  zh: {
    'app.name': '婚礼小册',
    'app.loading': '加载中…',
    'app.retry': '重试',
    'app.back': '返回',
    'app.save': '保存',
    'app.cancel': '取消',
    'app.offline': '当前离线，内容稍后会自动同步',

    'lang.toggle': 'EN',
    'lang.label': '切换语言',

    'wechat.title': '请在浏览器中打开',
    'wechat.body': '微信内置浏览器无法使用相机功能。请点击右上角的 ··· ，选择「在浏览器中打开」。',
    'wechat.programOnly': '只想看行程的话，可以继续留在这里。',
    'wechat.viewProgram': '查看行程',

    'welcome.title': '欢迎',
    'welcome.subtitle': '请输入你的邀请码',
    'welcome.codePlaceholder': '三位邀请码',
    'welcome.submit': '进入',
    'welcome.viewProgram': '先看看行程',
    'welcome.invalidCode': '邀请码不正确，请再确认一下',
    'welcome.tooManyAttempts': '尝试次数过多，请联系新人',

    'join.greeting': '你好，{name}',
    'join.confirm': '是你吗？',
    'join.yes': '是我',
    'join.no': '不是，重新输入',

    'nav.home': '首页',
    'nav.camera': '相机',
    'nav.bingo': '宾果',
    'nav.program': '行程',
    'nav.gallery': '相册',

    'program.title': '三天行程',
    'program.day': '第 {n} 天',
    'program.openMap': '在地图中打开',
    'program.hotel': '酒店',

    'camera.title': '一次性相机',
    'camera.blindHint': '看不到取景画面 —— 就像真的一次性相机。拍完当天不会显示，之后统一揭晓。',
    'camera.creditsLeft': '今天还剩 {n} 张',
    'camera.noCredits': '今天的额度用完了，明天再来',
    'camera.shoot': '拍摄',
    'camera.upload': '从相册上传（消耗 2 张额度）',
    'camera.saved': '已保存',
    'camera.permissionTitle': '需要相机权限',
    'camera.permissionBody': '接下来浏览器会询问相机权限，请选择「允许」。',
    'camera.permissionDenied': '没有相机权限，可以改为从相册上传。',

    'bingo.title': '宾果破冰',
    'bingo.subtitle': '找到答案对应的人，拍张合照',
    'bingo.progress': '已完成 {done} / {total}',
    'bingo.addPhoto': '拍照',
    'bingo.replacePhoto': '换一张',
    'bingo.yourAnswer': '你的答案',
    'bingo.privateHint': '你的答案只有你能看到，揭晓夜会一起分享',

    'gallery.title': '相册',
    'gallery.lockedTitle': '还没有揭晓',
    'gallery.lockedBody': '照片会在 {when} 一起揭晓',
    'gallery.anonymous': '匿名',
    'gallery.showName': '显示我的名字',
    'gallery.mine': '我拍的',
    'gallery.all': '全部',

    'me.title': '我的',
    'me.anonymousDefault': '默认匿名发布',
    'me.table': '座位',
  },

  en: {
    'app.name': 'Wedd Book',
    'app.loading': 'Loading…',
    'app.retry': 'Try again',
    'app.back': 'Back',
    'app.save': 'Save',
    'app.cancel': 'Cancel',
    'app.offline': "You're offline — this will sync automatically later",

    'lang.toggle': '中文',
    'lang.label': 'Switch language',

    'wechat.title': 'Please open in your browser',
    'wechat.body':
      "WeChat's built-in browser can't use the camera. Tap ··· in the top right, then \"Open in Browser\".",
    'wechat.programOnly': 'If you just want the itinerary, you can stay here.',
    'wechat.viewProgram': 'View itinerary',

    'welcome.title': 'Welcome',
    'welcome.subtitle': 'Enter your invite code',
    'welcome.codePlaceholder': '3-character code',
    'welcome.submit': 'Enter',
    'welcome.viewProgram': 'Just show me the itinerary',
    'welcome.invalidCode': "That code doesn't look right — mind checking it?",
    'welcome.tooManyAttempts': 'Too many attempts. Please ask the couple.',

    'join.greeting': 'Hello, {name}',
    'join.confirm': 'Is this you?',
    'join.yes': "That's me",
    'join.no': 'No, re-enter code',

    'nav.home': 'Home',
    'nav.camera': 'Camera',
    'nav.bingo': 'Bingo',
    'nav.program': 'Itinerary',
    'nav.gallery': 'Gallery',

    'program.title': 'Three days',
    'program.day': 'Day {n}',
    'program.openMap': 'Open in maps',
    'program.hotel': 'Hotel',

    'camera.title': 'Disposable camera',
    'camera.blindHint':
      "There's no viewfinder — just like a real disposable. You won't see these until they're revealed.",
    'camera.creditsLeft': '{n} shots left today',
    'camera.noCredits': "You've used today's roll. More tomorrow.",
    'camera.shoot': 'Shoot',
    'camera.upload': 'Upload from library (costs 2)',
    'camera.saved': 'Saved',
    'camera.permissionTitle': 'Camera access needed',
    'camera.permissionBody': 'Your browser will ask for camera permission next — please allow it.',
    'camera.permissionDenied': 'No camera access. You can upload from your library instead.',

    'bingo.title': 'Icebreaker bingo',
    'bingo.subtitle': 'Find the person each answer points to, then take a photo together',
    'bingo.progress': '{done} of {total} done',
    'bingo.addPhoto': 'Take photo',
    'bingo.replacePhoto': 'Replace',
    'bingo.yourAnswer': 'Your answer',
    'bingo.privateHint': "Only you can see your answers — we'll share them all on review night",

    'gallery.title': 'Gallery',
    'gallery.lockedTitle': 'Not revealed yet',
    'gallery.lockedBody': 'Photos are revealed {when}',
    'gallery.anonymous': 'Anonymous',
    'gallery.showName': 'Show my name',
    'gallery.mine': 'Mine',
    'gallery.all': 'Everyone',

    'me.title': 'You',
    'me.anonymousDefault': 'Post anonymously by default',
    'me.table': 'Table',
  },
} as const

export type Locale = keyof typeof strings
export type StringKey = keyof (typeof strings)['zh']
