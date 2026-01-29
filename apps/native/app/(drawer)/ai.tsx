import { useChat } from "@ai-sdk/react";
import { env } from "@contract-builder/env/native";
import { Ionicons } from "@expo/vector-icons";
import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import {
  Button,
  Divider,
  ErrorView,
  Spinner,
  Surface,
  TextField,
  useThemeColor,
} from "heroui-native";
import { useRef, useEffect, useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";

import { Container } from "@/components/container";

const generateAPIUrl = (relativePath: string) => {
  const serverUrl = env.EXPO_PUBLIC_SERVER_URL;
  if (!serverUrl) {
    throw new Error("EXPO_PUBLIC_SERVER_URL environment variable is not defined");
  }
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return serverUrl.concat(path);
};

export default function AIScreen() {
  const [input, setInput] = useState("");
  const { messages, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl("/ai"),
    }),
    onError: (error) => console.error(error, "AI Chat Error"),
  });
  const scrollViewRef = useRef<ScrollView>(null);
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const onSubmit = () => {
    const value = input.trim();
    if (value) {
      sendMessage({ text: value });
      setInput("");
    }
  };

  if (error) {
    return (
      <Container>
        <View className="flex-1 justify-center items-center px-4">
          <Surface variant="secondary" className="p-4 rounded-lg">
            <ErrorView isInvalid>
              <Text className="text-danger text-center font-medium mb-1">{error.message}</Text>
              <Text className="text-muted text-center text-xs">
                Please check your connection and try again.
              </Text>
            </ErrorView>
          </Surface>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 px-4 py-4">
          <View className="py-4 mb-4">
            <Text className="text-2xl font-semibold text-foreground tracking-tight">AI Chat</Text>
            <Text className="text-muted text-sm mt-1">Chat with our AI assistant</Text>
          </View>

          <ScrollView
            ref={scrollViewRef}
            className="flex-1 mb-4"
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View className="flex-1 justify-center items-center py-10">
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={mutedColor} />
                <Text className="text-muted text-sm mt-3">Ask me anything to get started</Text>
              </View>
            ) : (
              <View className="gap-2">
                {messages.map((message) => (
                  <Surface
                    key={message.id}
                    variant={message.role === "user" ? "tertiary" : "secondary"}
                    className={`p-3 rounded-lg ${message.role === "user" ? "ml-10" : "mr-10"}`}
                  >
                    <Text className="text-xs font-medium mb-1 text-muted">
                      {message.role === "user" ? "You" : "AI"}
                    </Text>
                    <View className="gap-1">
                      {message.parts.map((part, i) =>
                        part.type === "text" ? (
                          <Text
                            key={`${message.id}-${i}`}
                            className="text-foreground text-sm leading-relaxed"
                          >
                            {part.text}
                          </Text>
                        ) : (
                          <Text
                            key={`${message.id}-${i}`}
                            className="text-foreground text-sm leading-relaxed"
                          >
                            {JSON.stringify(part)}
                          </Text>
                        ),
                      )}
                    </View>
                  </Surface>
                ))}
              </View>
            )}
          </ScrollView>

          <Divider className="mb-3" />

          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <TextField>
                <TextField.Input
                  value={input}
                  onChangeText={setInput}
                  placeholder="Type a message..."
                  onSubmitEditing={onSubmit}
                  autoFocus
                />
              </TextField>
            </View>
            <Button
              isIconOnly
              variant={input.trim() ? "primary" : "secondary"}
              onPress={onSubmit}
              isDisabled={!input.trim()}
              size="sm"
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={input.trim() ? foregroundColor : mutedColor}
              />
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Container>
  );
}
