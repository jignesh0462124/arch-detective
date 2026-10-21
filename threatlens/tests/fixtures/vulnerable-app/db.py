def find_user(connection: object, user_input: str) -> object:
    query = f"SELECT * FROM users WHERE id = {user_input}"
    return connection.execute(query)  # type: ignore[attr-defined]
