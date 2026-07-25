// ابزارک شناور ثبت استعلام سریع برای سایت پیشرو تجهیز فرتاک
// اگر این فایل را در هر کجای سایت فراخوانی کنید، دکمه شناور استعلام در گوشه تصویر ظاهر می‌شود.

(function() {
    var style = document.createElement('style');
    style.innerHTML = `
        .ptf-rfq-float-btn {
            position: fixed;
            bottom: 25px;
            left: 25px;
            background: linear-gradient(135deg, #f58220 0%, #d96f15 100%);
            color: white !important;
            padding: 14px 24px;
            border-radius: 50px;
            font-family: 'Vazirmatn', Tahoma, sans-serif;
            font-size: 14px;
            font-weight: bold;
            text-decoration: none;
            box-shadow: 0 6px 20px rgba(245, 130, 32, 0.4);
            z-index: 999999;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
            cursor: pointer;
            border: 2px solid #ffffff;
        }
        .ptf-rfq-float-btn:hover {
            transform: translateY(-4px) scale(1.03);
            box-shadow: 0 10px 25px rgba(245, 130, 32, 0.6);
            background: linear-gradient(135deg, #d96f15 0%, #b85b0e 100%);
        }
        @media (max-width: 600px) {
            .ptf-rfq-float-btn {
                bottom: 15px;
                left: 15px;
                padding: 10px 18px;
                font-size: 13px;
            }
        }
    `;
    document.head.appendChild(style);

    var btn = document.createElement('a');
    btn.href = '/rfq/';
    btn.className = 'ptf-rfq-float-btn';
    btn.innerHTML = '<span>📋 ثبت استعلام پروژه‌ای (RFQ)</span>';
    document.body.appendChild(btn);
})();
