- Use the repo's runner: **RSpec** (`spec/`, `bundle exec rspec path:line`) or **Minitest**
  (`test/`, `bin/rails test path:line`) — check the `Gemfile` and which dir exists. Match neighbors.
- Use **FactoryBot** factories or fixtures as the repo does. Paste the narrowest command + output.
- Block real HTTP with **WebMock/VCR**; don't hit third parties in tests. Cover happy path + a failure.
