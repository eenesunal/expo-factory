FROM node:20-slim

# TUZAK #5: node:20-slim gibi imajlarda HİÇ FONT YOK. sharp/librsvg ile
# SVG->PNG render ederken sistemde font olmadan TÜM metin boş kutucuk (tofu)
# olarak çizilir — render "başarılı" döner, çıktı okunamaz olur.
# fontconfig + DejaVu, Türkçe karakterleri (ğ ş ı ç ö ü) kapsayan bir güvenlik ağı.
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src

# Uygulamanın kendi fontları. templates.js ölçüm için ../fonts/*.ttf'i doğrudan
# okuyor (./fonts), SVG rasterizerinin de bulabilmesi için ayrıca sistem font
# dizinine kopyalanıp fc-cache çalıştırılıyor. İkisi de gerekli.
COPY fonts ./fonts
COPY fonts /usr/share/fonts/truetype/app
RUN fc-cache -f

ENV PORT=8787
EXPOSE 8787
CMD ["node", "src/server.js"]
