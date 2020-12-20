FROM ruby:2.7

WORKDIR /blog
ADD Gemfile ./
ADD Gemfile.lock ./

RUN bundle install
