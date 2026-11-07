FROM php:8.3-cli AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    unzip \
    libpq-dev \
    librabbitmq-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libwebp-dev \
    libfreetype6-dev \
    libzip-dev \
    libicu-dev \
    libxml2-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
        pdo_pgsql \
        gd \
        exif \
        intl \
        zip \
        opcache \
        xml \
    && pecl install amqp \
    && docker-php-ext-enable amqp \
    && rm -rf /var/lib/apt/lists/*

RUN printf "upload_max_filesize=256M\npost_max_size=256M\nmemory_limit=512M\nmax_execution_time=300\n" > /usr/local/etc/php/conf.d/uploads.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

FROM base AS dev
COPY composer.json composer.lock symfony.lock ./
RUN composer install --no-scripts --no-interaction --prefer-dist
COPY . .
RUN mkdir -p var public/uploads && chmod -R 777 var public/uploads
EXPOSE 8000
CMD ["sh", "-c", "php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration && php -S 0.0.0.0:8000 -t public public/router.php"]

FROM base AS prod
ENV APP_ENV=prod
ENV APP_DEBUG=0
COPY composer.json composer.lock symfony.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction --prefer-dist
COPY . .
RUN mkdir -p var public/uploads && php bin/console cache:clear --env=prod && chmod -R 777 var public/uploads
EXPOSE 8000
CMD ["sh", "-c", "php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration && php -S 0.0.0.0:8000 -t public public/router.php"]
